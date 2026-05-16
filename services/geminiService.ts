
import { GoogleGenAI } from "@google/genai";
import { WeeklyPayment } from "../types";

export const generateReceiptText = async (payment: WeeklyPayment): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const workerSummary = payment.workers.map(w => {
    const daysWorked = Object.values(w.attendance).filter(Boolean).length;
    const advanceAmount = (w.hasAdvance && w.advanceDays) ? w.advanceDays * w.dailyRate : 0;
    const total = (daysWorked * w.dailyRate) + advanceAmount;
    
    if (daysWorked === 0 && advanceAmount === 0) return null;
    
    let line = `-${w.name} (${w.role}): ${daysWorked} dias trabalhados`;
    if (advanceAmount > 0) {
      line += ` + ${w.advanceDays} diárias de adiantamento`;
    }
    line += ` (Total R$ ${total.toFixed(2).replace('.', ',')})**`;
    
    return line;
  }).filter(Boolean).join('\n');

  const prompt = `
    Aja como um administrador de obras. Gere EXATAMENTE o texto abaixo, respeitando as quebras de linha e símbolos.
    NÃO adicione introduções ou conclusões extras.

    MODELO OBRIGATÓRIO:
    *Fechamento de Pagamentos – Semanal*

    Seguem os valores referentes aos serviços prestados no período de ${payment.startDate} a ${payment.endDate}:

    ${workerSummary}

    —Total Geral da Semana: R$ ${payment.totalAmount.toFixed(2).replace('.', ',')}

    Seguem os comprovantes em anexo.

    Qualquer dúvida, estou à disposição.
    Atenciosamente,

    ** Leonardo **
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text?.trim() || "Erro ao gerar resumo.";
  } catch (error) {
    console.error("Error generating receipt:", error);
    return "Desculpe, não foi possível gerar o resumo automático agora.";
  }
};
