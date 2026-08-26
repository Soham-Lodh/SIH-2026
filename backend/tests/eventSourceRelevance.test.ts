import test from 'node:test';
import assert from 'node:assert/strict';
import { filterSourcesForEvent } from '../server/lib/evidenceUtils';

const articles = [
  {
    title: 'Cyclone Amphan: West Bengal counts damage after 2020 landfall',
    summary: 'The cyclone hit West Bengal in May 2020, killing people and damaging homes.',
  },
  {
    title: 'South Korea heatwave warning issued',
    summary: 'Officials warned residents about high temperatures and health risks.',
  },
  {
    title: 'Kerala heat warning as temperatures rise',
    summary: 'A weather alert was issued for several Kerala districts in India.',
  },
  {
    title: 'Kathua landslide blocks highway',
    summary: 'A landslide damaged a road after heavy rain in Jammu and Kashmir.',
  },
  {
    title: 'Cyclone Nivar alert for Tamil Nadu coast',
    summary: 'Authorities prepared shelters as Cyclone Nivar approached in 2020.',
  },
];

test('event-specific source gate excludes Amphan-adjacent but off-topic articles', () => {
  const filtered = filterSourcesForEvent(articles, {
    eventName: 'Cyclone Amphan',
    disasterType: 'Cyclone',
    state: 'West Bengal',
    approxDate: '2020-05-20',
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, articles[0].title);
});
