import { el } from '../utils/dom.js';
import { EFETIVO_CAMPOS } from '../utils/format.js';

/**
 * Grade de contadores numéricos para o efetivo utilizado num lançamento
 * (mão de obra por função + equipamento). Usada tanto no formulário de
 * lançar quanto nas edições — mantém a mesma lista de campos e o mesmo
 * saneamento (inteiro, nunca negativo) num único lugar.
 */
export function efetivoInputs(initial = {}) {
  const inputs = {};

  const grid = el(
    'div',
    { style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' } },
    EFETIVO_CAMPOS.map((c) => {
      const input = el('input', {
        class: 'input mono',
        type: 'number',
        inputmode: 'numeric',
        min: '0',
        step: '1',
        value: String(Math.max(0, Math.round(Number(initial[c.key]) || 0))),
        style: { textAlign: 'center' }
      });
      inputs[c.key] = input;
      return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } }, [
        el('label', { style: { fontSize: '11.5px', color: 'var(--text-2)', fontWeight: '600' } }, c.label),
        input
      ]);
    })
  );

  function getValue() {
    const out = {};
    EFETIVO_CAMPOS.forEach((c) => {
      out[c.key] = Math.max(0, Math.round(Number(inputs[c.key].value) || 0));
    });
    return out;
  }

  return { node: grid, getValue };
}
