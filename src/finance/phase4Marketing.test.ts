import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFaqJsonLd,
  computeFunnelSummary,
  filterApprovedTestimonials,
  sanitizeWhatsappUrl,
  validateEmailAuthFields,
} from './phase4Marketing.ts';
import type { FaqItem, FunnelEventRecord, TestimonialItem } from '../types/finance.ts';

test('sanitizeWhatsappUrl normalizes Chilean numbers, valid wa.me links, and rejects unsafe schemes', () => {
  assert.equal(sanitizeWhatsappUrl('+56 9 8765 4321'), 'https://wa.me/56987654321');
  assert.equal(sanitizeWhatsappUrl('987654321'), 'https://wa.me/56987654321');
  assert.equal(
    sanitizeWhatsappUrl('https://wa.me/56987654321?text=Hola'),
    'https://wa.me/56987654321?text=Hola'
  );
  assert.equal(sanitizeWhatsappUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeWhatsappUrl('https://evil.example/wa'), null);
  assert.equal(sanitizeWhatsappUrl('123'), null);
  assert.equal(sanitizeWhatsappUrl(''), null);
});

test('filterApprovedTestimonials hides empty or non-consented testimonials', () => {
  const items: TestimonialItem[] = [
    {
      id: 't1',
      name: 'Camila Rojas',
      businessName: 'Velas del Sur',
      quote: 'Me ordenó los costos en una tarde.',
      permissionGranted: true,
    },
    {
      id: 't2',
      name: 'Pedro Soto',
      businessName: 'Café Nube',
      quote: 'Muy útil.',
      permissionGranted: false,
    },
    {
      id: 't3',
      name: '   ',
      businessName: 'Sin nombre',
      quote: 'Texto',
      permissionGranted: true,
    },
  ];
  const approved = filterApprovedTestimonials(items);
  assert.equal(approved.length, 1);
  assert.equal(approved[0].id, 't1');
  assert.deepEqual(filterApprovedTestimonials([]), []);
  assert.deepEqual(filterApprovedTestimonials(undefined), []);
});

test('buildFaqJsonLd generates valid FAQPage JSON-LD only from published FAQs', () => {
  const faqs: FaqItem[] = [
    {
      id: '1',
      question: '¿Qué es Growy?',
      answer: 'Una plataforma simple para pymes.',
      category: 'uso',
      order: 1,
      published: true,
    },
    {
      id: '2',
      question: 'Borrador interno',
      answer: 'No publicar aún.',
      category: 'uso',
      order: 2,
      published: false,
    },
  ];

  const schema = buildFaqJsonLd(faqs) as {
    '@type': string;
    mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>;
  };
  assert.ok(schema);
  assert.equal(schema['@type'], 'FAQPage');
  assert.equal(schema.mainEntity.length, 1);
  assert.equal(schema.mainEntity[0].name, '¿Qué es Growy?');
  assert.equal(buildFaqJsonLd([faqs[1]]), null);
});

test('computeFunnelSummary computes conversion percentages cleanly and handles empty or zero-visit cases', () => {
  const empty = computeFunnelSummary([]);
  assert.equal(empty.totalEvents, 0);
  assert.equal(empty.uniqueSessions, 0);
  assert.equal(empty.steps[0].conversionFromVisitPct, 0);

  const events: FunnelEventRecord[] = [
    { id: '1', sessionId: 's1', step: 'visit', day: '2026-11-20' },
    { id: '2', sessionId: 's2', step: 'visit', day: '2026-11-20' },
    { id: '3', sessionId: 's1', step: 'login', day: '2026-11-20' },
    { id: '4', sessionId: 's1', step: 'onboarding', day: '2026-11-20' },
    { id: '5', sessionId: 's1', step: 'first_calculation', day: '2026-11-20' },
    { id: '6', sessionId: 's1', step: 'payment', day: '2026-11-20' },
  ];

  const summary = computeFunnelSummary(events);
  assert.equal(summary.uniqueSessions, 2);
  assert.equal(summary.steps[0].uniqueSessions, 2); // visit
  assert.equal(summary.steps[1].uniqueSessions, 1); // login
  assert.equal(summary.steps[1].conversionFromVisitPct, 50);
  assert.equal(summary.steps[4].conversionFromPreviousPct, 100);
});

test('validateEmailAuthFields validates signup, signin and reset modes with friendly errors', () => {
  assert.equal(
    validateEmailAuthFields({ mode: 'signin', email: 'malcorreo', password: '123456' }).valid,
    false
  );
  assert.equal(
    validateEmailAuthFields({ mode: 'signup', email: 'pyme@chile.cl', password: '123', displayName: 'Ana' }).valid,
    false
  );
  assert.equal(
    validateEmailAuthFields({ mode: 'signup', email: 'pyme@chile.cl', password: 'secret123', displayName: '' }).valid,
    false
  );
  assert.equal(
    validateEmailAuthFields({ mode: 'signup', email: 'pyme@chile.cl', password: 'secret123', displayName: 'Taller Sol' }).valid,
    true
  );
  assert.equal(
    validateEmailAuthFields({ mode: 'reset', email: 'pyme@chile.cl', password: '' }).valid,
    true
  );
});
