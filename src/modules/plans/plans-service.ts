import { PlanDocument } from "./plans-entity";
import { PlanModelHandler } from "./plans-model";
import { PricingConfig } from "../../config/pricing";

export class PlanService {
  static async listPlans(includeInactive: boolean = false): Promise<any[]> {
    const plans = await PlanModelHandler.findAll(includeInactive);

    return plans.map((plan) => {
      const planObj = plan.toObject ? plan.toObject() : JSON.parse(JSON.stringify(plan));
      return {
        ...planObj,
        maxInstallments: PricingConfig.calculateMaxInstallments(planObj.price),
      };
    });
  }

  static async getPlanById(id: string): Promise<PlanDocument | null> {
    return await PlanModelHandler.findById(id);
  }

  static async createPlan(planData: Omit<PlanDocument, "_id">): Promise<PlanDocument> {
    if (!planData.name) throw new Error("O nome do plano é obrigatório.");
    if (!planData.price) throw new Error("O preço do plano é obrigatório.");
    return await PlanModelHandler.create(planData);
  }

  static async updatePlan(id: string, planData: Partial<PlanDocument>): Promise<PlanDocument | null> {
    return await PlanModelHandler.update(id, planData);
  }

  static async deletePlan(id: string): Promise<boolean> {
    return await PlanModelHandler.delete(id);
  }


  static calculateAnnualPrice(monthlyPrice: number): number {
    return PricingConfig.calculateAnnualPrice(monthlyPrice);
  }


  static calculateAnnualSavings(monthlyPrice: number): number {
    return PricingConfig.calculateAnnualSavings(monthlyPrice);
  }


  static getAnnualDiscountPercent(): number {
    return PricingConfig.ANNUAL_DISCOUNT_PERCENT;
  }


  static async listPlansWithAnnualOptions(includeInactive: boolean = false): Promise<any[]> {
    const plans = await PlanModelHandler.findAll(includeInactive);

    return plans.map((plan) => {
      const planObj = plan.toObject ? plan.toObject() : JSON.parse(JSON.stringify(plan));

      const annualPrice = this.calculateAnnualPrice(planObj.price);
      const annualSavings = this.calculateAnnualSavings(planObj.price);

      return {
        ...planObj,
        maxInstallments: PricingConfig.calculateMaxInstallments(planObj.price),
        pricing: {
          monthly: {
            price: planObj.price,
            interval: "monthly",
            displayText: `/mês`,
          },
          annual: {
            price: annualPrice,
            savings: annualSavings,
            discountPercent: PricingConfig.ANNUAL_DISCOUNT_PERCENT,
            interval: "yearly",
            displayText: `/ano`,
            savingsText: `Economize R$ ${annualSavings.toFixed(2).replace(".", ",")}`,
          },
        },
      };
    });
  }


  static async createAnnualPlan(monthlyPlanId: string): Promise<PlanDocument> {
    const monthlyPlan = await this.getPlanById(monthlyPlanId);
    if (!monthlyPlan) {
      throw new Error("Plano mensal não encontrado.");
    }

    const annualPlanData = {
      name: monthlyPlan.name,
      description: monthlyPlan.description,
      price: this.calculateAnnualPrice(monthlyPlan.price),
      interval: "yearly" as const,
      features: monthlyPlan.features,
      permissions: monthlyPlan.permissions,
      isActive: monthlyPlan.isActive,
    } as Omit<PlanDocument, "_id">;

    return await PlanModelHandler.create(annualPlanData);
  }


  static isAnnualPlan(plan: PlanDocument): boolean {
    return plan.interval === "yearly";
  }

  static calculateEquivalentMonthlyPrice(annualPrice: number): number {
    const discountFactor = 1 - PricingConfig.ANNUAL_DISCOUNT_PERCENT / 100;
    const originalYearlyPrice = annualPrice / discountFactor;
    return parseFloat((originalYearlyPrice / 12).toFixed(2));
  }
}
