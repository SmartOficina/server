/**
 * Configurações centrais de preços e descontos
 */
export class PricingConfig {
  /**
   * Percentual de desconto para planos anuais
   * Esta variável controla o desconto aplicado a todos os planos anuais
   */
  static readonly ANNUAL_DISCOUNT_PERCENT = parseFloat(process.env.ANNUAL_DISCOUNT_PERCENT || "20");

  /**
   * Configurações de parcelamento
   */
  static readonly MIN_INSTALLMENT_PRICE = parseFloat(process.env.MIN_INSTALLMENT_PRICE || "59.90");
  static readonly INSTALLMENT_INCREMENT = parseFloat(process.env.INSTALLMENT_INCREMENT || "19.90");
  static readonly MAX_INSTALLMENTS = parseInt(process.env.MAX_INSTALLMENTS || "12");

  /**
   * Valor mínimo para cobrança em upgrades
   */
  static readonly MIN_CHARGE_AMOUNT = parseFloat(process.env.MIN_CHARGE_AMOUNT || "5");

  /**
   * Calcula o preço anual com desconto baseado no preço mensal
   */
  static calculateAnnualPrice(monthlyPrice: number): number {
    const yearlyPrice = monthlyPrice * 12;
    const discount = (yearlyPrice * this.ANNUAL_DISCOUNT_PERCENT) / 100;
    return parseFloat((yearlyPrice - discount).toFixed(2));
  }

  /**
   * Calcula a economia anual em reais
   */
  static calculateAnnualSavings(monthlyPrice: number): number {
    const yearlyPrice = monthlyPrice * 12;
    const discountedPrice = this.calculateAnnualPrice(monthlyPrice);
    return parseFloat((yearlyPrice - discountedPrice).toFixed(2));
  }

  /**
   * Calcula o número máximo de parcelas para um valor
   */
  static calculateMaxInstallments(price: number): number {
    if (price <= this.MIN_INSTALLMENT_PRICE) {
      return 1;
    }

    const installments = Math.min(Math.floor((price - this.MIN_INSTALLMENT_PRICE) / this.INSTALLMENT_INCREMENT) + 2, this.MAX_INSTALLMENTS);

    return installments;
  }
}
