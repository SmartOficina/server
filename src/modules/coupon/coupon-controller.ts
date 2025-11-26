import { Request, Response } from "express";
import logger from "../../logger";
import CouponService from "./coupon-service";
import { PlanService } from "../plans/plans-service";

class CouponController {
  static async validateCoupon(req: Request, res: Response) {
    try {
      const { code, planId, interval } = req.body;

      if (!code) {
        return res.status(400).json({ msg: "Código do cupom é obrigatório." });
      }

      if (!planId) {
        return res.status(400).json({ msg: "ID do plano é obrigatório." });
      }

      const plan = await PlanService.getPlanById(planId);
      if (!plan) {
        return res.status(404).json({ msg: "Plano não encontrado." });
      }

      const validationResult = await CouponService.validateCoupon(code, planId, interval || "monthly");

      if (!validationResult.valid || !validationResult.coupon) {
        return res.status(400).json({
          valid: false,
          msg: validationResult.message || "Cupom inválido.",
        });
      }

      let originalPrice = plan.price;
      if (interval === "yearly") {
        originalPrice = PlanService.calculateAnnualPrice(plan.price);
      }

      const discountedPrice = CouponService.calculateDiscountedPrice(originalPrice, validationResult.coupon);

      return res.status(200).json({
        valid: true,
        couponId: validationResult.coupon._id,
        code: validationResult.coupon.code,
        discount: validationResult.coupon.discount,
        originalPrice,
        discountedPrice,
        savings: originalPrice - discountedPrice,
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "CouponController::validateCoupon()");
      return res.status(500).json({ msg: "Erro ao validar cupom.", error: error.message });
    }
  }


  static async getPlanForCoupon(req: Request, res: Response) {
    try {
      const { code } = req.params;

      if (!code) {
        return res.status(400).json({ msg: "Código do cupom é obrigatório." });
      }

      const coupon = await CouponService.findCouponByCode(code);

      if (!coupon) {
        return res.status(404).json({ msg: "Cupom não encontrado." });
      }

      if (coupon.planId.toString() === "todos") {
        return res.status(400).json({
          msg: "Este cupom é válido para qualquer plano.",
        });
      }

      const plan = await PlanService.getPlanById(coupon.planId.toString());

      if (!plan) {
        return res.status(404).json({ msg: "Plano associado ao cupom não encontrado." });
      }

      return res.status(200).json({ result: plan });
    } catch (error: any) {
      logger.error({ error: error.message }, "CouponController::getPlanForCoupon()");
      return res.status(500).json({ msg: "Erro ao buscar plano para o cupom.", error: error.message });
    }
  }

}

export default CouponController;
