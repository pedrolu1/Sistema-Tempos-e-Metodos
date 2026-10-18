import { el } from '../utils/dom.js';
import { EFETIVO_CAMPOS } from '../utils/format.js';

function clamp(n) {
  return Math.max(0, Math.round(Number(n) || 0));
}

/**
 * Grade de contadores (steppers −/número/+) para o efetivo utilizado num
 * lançamento (mão de obra por função + equipamento). Usada tanto no
 * formulário de lançar quanto nas edições — mantém a mesma lista de campos
 * e o mesmo saneamento (inteiro, nunca negativo) num único lugar.
 *
 * Steppers em vez de um campo numérico cru: em campo, tocar um botão grande
 * é mais rápido e confiável do que abrir o teclado numérico do celular —
 * inclusive com luvas.
 *
 * `onChange` (opcional) é chamado a cada alteração — usado no app mobile para
 * reavaliar em tempo real se o efetivo passou do padrão. `setValues` permite
 * pré-preencher a grade quando o líder escolhe uma atividade com padrão;
 * `setPlanejado` mostra ao lado de cada função quanto foi planejado.
 */
export function efetivoInputs(initial = {}, onChange) {
  const inputs = {};
  const planTags = {};
  let planejado = null; // quando definido, cada função mostra "plan. N" e destaca a diferença

  function marcarDiferencas() {
    EFETIVO_CAMPOS.forEach((c) => {
      const tag = planTags[c.key];
      if (!planejado) {
        tag.textContent = '';
        return;
      }
      const plan = clamp(planejado[c.key]);
      const diff = clamp(inputs[c.key].value) !== plan;
      tag.textContent = `plan. ${plan}`;
      tag.classList.toggle('diff', diff);
    });
  }

  const grid = el(
    'div',
    { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' } },
    EFETIVO_CAMPOS.map((c) => {
      const input = el('input', {
        class: 'mono',
        type: 'number',
        inputmode: 'numeric',
        min: '0',
        step: '1',
        value: String(clamp(initial[c.key]))
      });
      inputs[c.key] = input;

      const setVal = (n) => {
        input.value = String(clamp(n));
        marcarDiferencas();
        if (onChange) onChange();
      };
      input.addEventListener('change', () => setVal(input.value));

      const stepper = el('div', { class: 'stepper' }, [
        el('button', { type: 'button', class: 'stepper-btn', 'aria-label': `Diminuir ${c.label}`, onclick: () => setVal(Number(input.value) - 1) }, '−'),
        input,
        el('button', { type: 'button', class: 'stepper-btn', 'aria-label': `Aumentar ${c.label}`, onclick: () => setVal(Number(input.value) + 1) }, '+')
      ]);

      planTags[c.key] = el('span', { class: 'stepper-plan' });
      return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } }, [
        el('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '6px' } }, [
          el('label', { title: c.label, style: { fontSize: '11.5px', color: 'var(--text-2)', fontWeight: '600', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c.label),
          planTags[c.key]
        ]),
        stepper
      ]);
    })
  );

  function getValue() {
    const out = {};
    EFETIVO_CAMPOS.forEach((c) => {
      out[c.key] = clamp(inputs[c.key].value);
    });
    return out;
  }

  function setValues(obj = {}) {
    EFETIVO_CAMPOS.forEach((c) => {
      inputs[c.key].value = String(clamp(obj[c.key]));
    });
    marcarDiferencas();
    if (onChange) onChange();
  }

  /** Define (ou limpa, com null) o efetivo planejado usado como referência visual. */
  function setPlanejado(obj) {
    planejado = obj;
    marcarDiferencas();
  }

  return { node: grid, getValue, setValues, setPlanejado };
}
