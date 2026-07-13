import assert from 'node:assert/strict';
import test from 'node:test';
import { getTripStampDesign, getTripStampLabel } from '../src/components/TripStamp';

test('trip stamps are deterministic and use the first location segment', () => {
  assert.deepEqual(getTripStampDesign('trip-123'), getTripStampDesign('trip-123'));
  assert.equal(getTripStampLabel('Đà Lạt, Lâm Đồng'), 'Đà Lạt');
  assert.equal(getTripStampLabel(''), 'Hành trình');
});
