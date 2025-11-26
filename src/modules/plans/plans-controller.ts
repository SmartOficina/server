import { Request, Response } from "express";
import logger from "../../logger";
import { PlanService } from "./plans-service";
import { PricingConfig } from "../../config/pricing";

class PlanController {
  static async listPlans(req: Request, res: Response) {
    try {
      const { includeInactive } = req.query;
      const plans = await PlanService.listPlans(includeInactive === "true");
      if (plans.length === 0) {
        return res.status(404).json({ msg: "Nenhum plano encontrado." });
      }
      res.status(200).json({ result: plans, msg: "Planos listados com sucesso." });
    } catch (error: any) {
      logger.error({ error: error.message }, "PlanController::listPlans()");
      res.status(500).json({ msg: "Erro ao listar planos.", error: error.message });
    }
  }

  static async listPlansWithAnnualOptions(req: Request, res: Response) {
    try {
      const { includeInactive } = req.query;
      const plans = await PlanService.listPlansWithAnnualOptions(includeInactive === "true");
      if (plans.length === 0) {
        return res.status(404).json({ msg: "Nenhum plano encontrado." });
      }
      res.status(200).json({ result: plans, msg: "Planos com opções anuais listados com sucesso." });
    } catch (error: any) {
      logger.error({ error: error.message }, "PlanController::listPlansWithAnnualOptions()");
      res.status(500).json({ msg: "Erro ao listar planos com opções anuais.", error: error.message });
    }
  }

  static async getPlanById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const plan = await PlanService.getPlanById(id);
      if (!plan) {
        return res.status(404).json({ msg: "Plano não encontrado." });
      }
      res.status(200).json({ result: plan, msg: "Plano encontrado com sucesso." });
    } catch (error: any) {
      logger.error({ error: error.message }, "PlanController::getPlanById()");
      res.status(500).json({ msg: "Erro ao buscar plano.", error: error.message });
    }
  }

  static async createPlan(req: Request, res: Response) {
    try {
      const newPlan = await PlanService.createPlan(req.body);
      res.status(201).json({ result: newPlan, msg: "Plano criado com sucesso." });
    } catch (error: any) {
      logger.error({ error: error.message }, "PlanController::createPlan()");
      res.status(500).json({ msg: "Erro ao criar plano.", error: error.message });
    }
  }

  static async updatePlan(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updatedPlan = await PlanService.updatePlan(id, req.body);
      if (!updatedPlan) {
        return res.status(404).json({ msg: "Plano não encontrado." });
      }
      res.status(200).json({ result: updatedPlan, msg: "Plano atualizado com sucesso." });
    } catch (error: any) {
      logger.error({ error: error.message }, "PlanController::updatePlan()");
      res.status(500).json({ msg: "Erro ao atualizar plano.", error: error.message });
    }
  }

  static async deletePlan(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const success = await PlanService.deletePlan(id);
      if (!success) {
        return res.status(404).json({ msg: "Plano não encontrado." });
      }
      res.status(200).json({ msg: "Plano excluído com sucesso." });
    } catch (error: any) {
      logger.error({ error: error.message }, "PlanController::deletePlan()");
      res.status(500).json({ msg: "Erro ao excluir plano.", error: error.message });
    }
  }

  /**
   * Obter configurações de pricing (desconto anual, valor mínimo de parcela, etc.)
   */
  static async getPricingConfig(req: Request, res: Response) {
    try {
      const config = {
        annualDiscountPercent: PricingConfig.ANNUAL_DISCOUNT_PERCENT,
        minInstallmentPrice: PricingConfig.MIN_INSTALLMENT_PRICE,
        installmentIncrement: PricingConfig.INSTALLMENT_INCREMENT,
        maxInstallments: PricingConfig.MAX_INSTALLMENTS,
        minChargeAmount: PricingConfig.MIN_CHARGE_AMOUNT,
      };

      res.status(200).json({
        msg: "Configurações de pricing obtidas com sucesso.",
        result: config,
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "PlanController::getPricingConfig()");
      res.status(500).json({ msg: "Erro ao obter configurações de pricing.", error: error.message });
    }
  }
}

export default PlanController;
