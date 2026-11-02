// bun test tools/test — client grouping for the Pages Function throttles.
import { expect, test } from 'bun:test';
import { ipKey } from '../../functions/api/[[path]]';

test('IPv4 stays as is', () => expect(ipKey('1.2.3.4')).toBe('1.2.3.4'));
test('IPv6 groups by /64', () => {
  expect(ipKey('2001:db8:a:b:c:d:e:f')).toBe('2001:db8:a:b::/64');
  expect(ipKey('2001:0db8:000a:b::1')).toBe('2001:db8:a:b::/64');
  expect(ipKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
  expect(ipKey('::1')).toBe('0:0:0:0::/64');
});
