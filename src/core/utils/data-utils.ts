export function removeEmptyFields(data: any): any {
  Object.keys(data).forEach((key) => {
    if (typeof data[key] === "object" && data[key] !== null) {
      data[key] = removeEmptyFields(data[key]);
    }
    if (data[key] === "" || data[key] === null || data[key] === undefined) {
      delete data[key];
    }
  });
  return data;
}

/**
 * Normaliza strings removendo acentos, caracteres especiais e convertendo para minúsculas
 * @param text String a ser normalizada
 * @returns String normalizada
 */
export function normalizeText(text: string): string {
  if (!text) return "";

  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Remove todos os caracteres não numéricos de uma string
 * @param text String a ser processada
 * @returns String contendo apenas números
 */
export function extractNumbers(text: string): string {
  if (!text) return "";

  return text.replace(/\D/g, "");
}

/**
 * Formata uma data no padrão DD/MM/YYYY
 * @param date Objeto Date a ser formatado
 * @returns String formatada
 */
export function formatDate(date: Date): string {
  if (!date) return "";

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Converte uma string de data para objeto Date
 * Suporta formatos DD/MM/YYYY e YYYY-MM-DD
 * @param dateString String de data
 * @returns Objeto Date ou null se inválido
 */
export function parseDate(dateString: string): Date | null {
  if (!dateString) return null;

  let date: Date | null = null;

  if (dateString.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    const parts = dateString.split("/");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);

    date = new Date(year, month, day);
  } else if (dateString.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
    date = new Date(dateString);
  }
  if (date && isNaN(date.getTime())) {
    return null;
  }

  return date;
}
