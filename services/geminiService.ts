
import { GoogleGenAI } from "@google/genai";
import { WeeklyPayment } from "../types";

export const generateReceiptText = async (payment: WeeklyPayment): Promise<string> => {
  const workerSummary = payment.workers.map(w => {
    const daysWorked = Object.values(w.attendance).filter(Boolean).length;
    const advanceAmount = (w.hasAdvance && w.advanceDays) ? w.advanceDays * w.dailyRate : 0;
    const deductionAmount = (w.hasDeduction && w.deductionDays) ? w.deductionDays * w.dailyRate : 0;
    const total = (daysWorked * w.dailyRate) + advanceAmount - deductionAmount;
    
    if (daysWorked === 0 && advanceAmount === 0 && deductionAmount === 0) return null;
    
    let line = `-${w.name} (${w.role}): ${daysWorked} dias trabalhados`;
    if (advanceAmount > 0) {
      line += ` + ${w.advanceDays} diárias de adiantamento`;
    }
    if (deductionAmount > 0) {
      line += ` - ${w.deductionDays} diárias de desconto de adiantamento`;
    }
    line += ` (Total R$ ${total.toFixed(2).replace('.', ',')})**`;
    
    return line;
  }).filter(Boolean).join('\n');

  const periodText = payment.endDate 
    ? `no período de ${payment.startDate} a ${payment.endDate}`
    : `na data de ${payment.startDate}`;

  const defaultText = `*Fechamento de Pagamentos – Semanal*

Seguem os valores referentes aos serviços prestados ${periodText}:

${workerSummary}

—Total Geral da Semana: R$ ${payment.totalAmount.toFixed(2).replace('.', ',')}

Seguem os comprovantes em anexo.

Qualquer dúvida, estou à disposição.
Atenciosamente,

** Leonardo **`;

  const prompt = `
    Aja como um administrador de obras. Gere EXATAMENTE o texto abaixo, respeitando as quebras de linha e símbolos.
    NÃO adicione introduções ou conclusões extras.

    MODELO OBRIGATÓRIO:
    *Fechamento de Pagamentos – Semanal*

    Seguem os valores referentes aos serviços prestados ${periodText}:

    ${workerSummary}

    —Total Geral da Semana: R$ ${payment.totalAmount.toFixed(2).replace('.', ',')}

    Seguem os comprovantes em anexo.

    Qualquer dúvida, estou à disposição.
    Atenciosamente,

    ** Leonardo **
  `;

  let apiKey = "";
  try {
    apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || "";
  } catch (e) {
    // Suppress error
  }

  if (!apiKey) {
    return defaultText;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text?.trim() || defaultText;
  } catch (error) {
    console.error("Error generating receipt with Gemini:", error);
    return defaultText;
  }
};
