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
 */
export function efetivoInputs(initial = {}) {
  const inputs = {};

  const grid = el(
    'div',
    { style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' } },
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
      };
      input.addEventListener('change', () => setVal(input.value));

      const stepper = el('div', { class: 'stepper' }, [
        el('button', { type: 'button', class: 'stepper-btn', 'aria-label': `Diminuir ${c.label}`, onclick: () => setVal(Number(input.value) - 1) }, '−'),
        input,
        el('button', { type: 'button', class: 'stepper-btn', 'aria-label': `Aumentar ${c.label}`, onclick: () => setVal(Number(input.value) + 1) }, '+')
      ]);

      return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } }, [
        el('label', { style: { fontSize: '11.5px', color: 'var(--text-2)', fontWeight: '600' } }, c.label),
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

  return { node: grid, getValue };
}
