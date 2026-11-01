// Plays the lesson on screen to the end, answering correctly (wrong first on every 3rd question,
// to exercise Try again). Injected by tools/web_qa.py ["js", ...]; resolves to a report string.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = (text) => [...document.querySelectorAll('footer button')].find((b) => b.textContent.trim() === text && !b.disabled);
  const errors = [];
  let n = 0, asks = 0;
  for (let guard = 0; guard < 80; guard++) {
    await sleep(120);
    if (!document.querySelector('.player')) break; // summary screen reached
    const st = globalThis.__sharpenStep;
    if (!st) { errors.push('no step'); break; }
    n++;
    if (st.kind === 'read') { btn('Continue')?.click(); continue; }
    asks++;
    const wrongFirst = asks % 3 === 0;
    const answer = async (right) => {
      if (st.kind === 'choice') {
        const opts = [...document.querySelectorAll('.option')];
        const want = st.options.find((o) => !!o.correct === right) ?? st.options.find((o) => o.correct);
        const el = opts.find((o) => o.textContent.trim() === want.text.replace(/\*\*|\*|`/g, '').trim());
        if (!el) { errors.push(`option not found: ${want.text}`); return; }
        el.click();
      } else if (st.kind === 'number') {
        const inp = document.querySelector('input.num');
        inp.value = right ? String(st.answer) : String(st.answer + 1000);
        inp.dispatchEvent(new Event('input'));
      } else if (st.kind === 'estimate') {
        const sl = document.querySelector('input.est');
        sl.value = String(right ? st.answer : (st.answer - st.min > (st.max - st.answer) ? st.min : st.max));
        sl.dispatchEvent(new Event('input'));
      } else if (st.kind === 'order') {
        // Bubble the list into the right order with the arrow buttons.
        for (let pass = 0; pass < 20 && right; pass++) {
          const items = [...document.querySelectorAll('.order li')].map((li) => li.querySelector('.order-text').textContent.trim());
          const want = st.items.map((t) => t.replace(/\*\*|\*|`/g, '').trim());
          const k = items.findIndex((t, j) => t !== want[j]);
          if (k < 0) break;
          const from = items.indexOf(want[k]);
          document.querySelectorAll('.order li')[from].querySelector('[aria-label="Move up"]').click();
          await sleep(20);
        }
      } else if (st.kind === 'task') {
        return 'skip';
      }
      await sleep(60);
      btn('Check')?.click();
      await sleep(120);
    };
    if (st.kind === 'task') {
      // Tasks can't be solved generically: give up and use Show answer.
      btn('Check')?.click();
      await sleep(80);
      if (btn('Show answer')) btn('Show answer').click(); else { errors.push('task without Show answer path'); }
      await sleep(80);
      btn('Continue')?.click();
      continue;
    }
    if (wrongFirst && st.kind !== 'order') {
      await answer(false);
      if (!document.querySelector('.feedback.bad')) errors.push(`step ${n}: wrong answer not marked wrong`);
      btn('Try again')?.click();
      await sleep(60);
    }
    await answer(true);
    if (!document.querySelector('.feedback.good')) {
      errors.push(`step ${n} (${st.kind}): right answer not accepted: ${(st.body || '').slice(0, 60)}`);
      btn('Show answer')?.click();
      await sleep(60);
    }
    btn('Continue')?.click();
  }
  const done = !!document.querySelector('.summary');
  return `steps ${n}, questions ${asks}, reached summary: ${done}; errors: ${errors.length ? errors.join(' || ') : 'none'}`;
})()
