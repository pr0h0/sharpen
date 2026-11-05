"""Drive the served web build in headless Chromium over the DevTools protocol (real time, real clicks).

Usage: python3 tools/web_qa.py OUT_DIR [STEPS_JSON]
  STEPS: [["click",x,y], ["move",x,y], ["wheel",x,y,dy], ["shot","name"], ["wait",seconds], ["reload",seconds], ["freeze",seconds]] at a 1440x810 viewport.
Writes OUT_DIR/w0.png after load, any named shots, and OUT_DIR/console.txt (console + exceptions).
Also: ["sel", css, text?] clicks an element, ["js", code] evaluates, ["type", text] types.
Env: QA_W, QA_H, QA_DPR (screen), QA_WAIT (seconds after load, default 3).
Needs chromium and websocket-client; the app must be served on http://127.0.0.1:4956.
"""
import json, subprocess, sys, time, base64, urllib.request
import websocket
import os
DBG = int(os.environ.get("QA_DEBUG_PORT", "9333"))
APP = os.environ.get("QA_URL", "http://127.0.0.1:4956/")
out = sys.argv[1]
VW, VH, DPR = int(os.environ.get("QA_W", 1440)), int(os.environ.get("QA_H", 810)), float(os.environ.get("QA_DPR", 1))
steps = json.loads(sys.argv[2]) if len(sys.argv) > 2 else []
chrome = subprocess.Popen([os.environ.get("CHROME", "chromium"), "--headless=new", "--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    f"--window-size={VW},{VH}", f"--user-data-dir={out}/prof", f"--remote-debugging-port={DBG}", f"--remote-allow-origins=http://127.0.0.1:{DBG}", "about:blank"],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{DBG}/json"))
            if tabs: break
        except Exception: time.sleep(0.2)
    page = [t for t in tabs if t["type"] == "page"][0]
    ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=600, origin=f"http://127.0.0.1:{DBG}")
    n = [0]
    logs = []
    def call(method, **params):
        n[0] += 1
        ws.send(json.dumps({"id": n[0], "method": method, "params": params}))
        while True:
            m = json.loads(ws.recv())
            if m.get("method") == "Runtime.consoleAPICalled":
                logs.append("[%s] %s" % (m["params"]["type"], " ".join(str(a.get("value", a.get("description", ""))) for a in m["params"]["args"])))
            elif m.get("method") == "Runtime.exceptionThrown":
                logs.append("[exception] %s" % m["params"]["exceptionDetails"].get("text"))
            if m.get("id") == n[0]:
                return m.get("result", {})
    call("Runtime.enable")
    call("Emulation.setFocusEmulationEnabled", enabled=True)  # don't throttle timers like a background tab
    call("Emulation.setDeviceMetricsOverride", width=VW, height=VH, deviceScaleFactor=DPR, mobile=False)
    call("Page.navigate", url=APP)
    def shot(name):
        r = call("Page.captureScreenshot", format="png")
        open(f"{out}/{name}.png", "wb").write(base64.b64decode(r["data"]))
    def click(x, y, button="left"):
        for t in ["mouseMoved", "mousePressed", "mouseReleased"]:
            call("Input.dispatchMouseEvent", type=t, x=x, y=y, button=button, clickCount=1)
            time.sleep(0.05)
    def wheel(x, y, dy):
        call("Input.dispatchMouseEvent", type="mouseWheel", x=x, y=y, deltaX=0, deltaY=dy)
    time.sleep(float(os.environ.get("QA_WAIT", 3)))
    shot("w0")
    for st in steps:
        if st[0] == "click": click(st[1], st[2]); time.sleep(1.2)
        elif st[0] == "wheel": wheel(st[1], st[2], st[3]); time.sleep(1.2)
        elif st[0] == "freeze":  # like a hidden tab: no frames for N seconds
            call("Page.setWebLifecycleState", state="frozen"); time.sleep(st[1])
            call("Page.setWebLifecycleState", state="active"); time.sleep(3)
        elif st[0] == "reload":
            call("Page.reload"); time.sleep(st[1] if len(st) > 1 else 30)
        elif st[0] == "sel":  # click the first element matching a CSS selector (optionally containing text)
            txt = st[2] if len(st) > 2 else ""
            r = call("Runtime.evaluate", expression="(() => { const els = [...document.querySelectorAll(%s)].filter(e => e.textContent.includes(%s)); if (!els.length) return 'none'; els[0].click(); return 'ok'; })()" % (json.dumps(st[1]), json.dumps(txt)), returnByValue=True)
            if r.get("result", {}).get("value") != "ok":
                logs.append("[qa] no element for %s %r" % (st[1], txt))
            time.sleep(0.6)
        elif st[0] == "jsfile":  # evaluate a script file (e.g. tools/autoplay.js)
            r = call("Runtime.evaluate", expression=open(st[1]).read(), returnByValue=True, awaitPromise=True)
            logs.append("[js] %s" % r.get("result", {}).get("value", r))
            time.sleep(0.4)
        elif st[0] == "js":
            r = call("Runtime.evaluate", expression=st[1], returnByValue=True, awaitPromise=True)
            logs.append("[js] %s" % r.get("result", {}).get("value"))
            time.sleep(0.4)
        elif st[0] == "type":  # type into the focused element
            call("Input.insertText", text=st[1]); time.sleep(0.3)
        elif st[0] == "move":
            call("Input.dispatchMouseEvent", type="mouseMoved", x=st[1], y=st[2]); time.sleep(1.0)
        elif st[0] == "shot": shot(st[1])
        elif st[0] == "wait": time.sleep(st[1])
    call("Runtime.evaluate", expression="1")  # flush pending console events
    open(f"{out}/console.txt", "w").write("\n".join(logs))
    print(len(logs), "console lines")
finally:
    chrome.kill()
