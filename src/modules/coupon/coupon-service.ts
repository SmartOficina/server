import mongoose from "mongoose";
import { CouponModel, CouponDocument } from "./coupon-entity";
import logger from "../../logger";

class CouponService {
  static async validateCoupon(code: string, planId: string, interval: "monthly" | "yearly" = "monthly"): Promise<{ valid: boolean; coupon?: CouponDocument; message?: string }> {
    try {
      const couponCode = code.trim().toUpperCase();

      const coupon = await CouponModel.findOne({ code: couponCode, isActive: true });

      if (!coupon) {
        return { valid: false, message: "Cupom não encontrado ou inativo." };
      }

      if (coupon.expirationDate < new Date()) {
        return { valid: false, message: "Cupom expirado." };
      }

      if (coupon.usageLimit <= 0) {
        return { valid: false, message: "Cupom esgotado." };
      }

      if (coupon.planId.toString() !== planId && coupon.planId.toString() !== "todos") {
        return { valid: false, message: "Cupom não é válido para este plano." };
      }

  
      if (coupon.interval && coupon.interval !== "both" && coupon.interval !== interval) {
        const periodText = interval === "monthly" ? "mensal" : "anual";
        const couponPeriodText = coupon.interval === "monthly" ? "mensal" : "anual";
        return { valid: false, message: `Este cupom é válido apenas para assinatura ${couponPeriodText}, mas você está tentando usar em uma assinatura ${periodText}.` };
      }

      return { valid: true, coupon };
    } catch (error: any) {
      logger.error({ error: error.message }, "CouponService::validateCoupon()");
      return { valid: false, message: "Erro ao validar cupom." };
    }
  }

  static calculateDiscountedPrice(price: number, coupon: CouponDocument): number {
    const discountAmount = (price * coupon.discount) / 100;
    return Math.max(0, price - discountAmount);
  }

  static async reserveCouponUse(couponId: string, userId: string): Promise<boolean> {
    try {
      const coupon = await CouponModel.findOneAndUpdate(
        { _id: couponId, usageLimit: { $gt: 0 } },
        {
          $inc: { usageLimit: -1 },
          $push: {
            usedBy: {
              userId: new mongoose.Types.ObjectId(userId),
              usedAt: new Date(),
            },
          },
        },
        { new: true }
      );

      if (!coupon) {
        return false;
      }

      return true;
    } catch (error: any) {
      logger.error({ error: error.message }, "CouponService::reserveCouponUse()");
      return false;
    }
  }

  static async revertCouponUse(couponId: string, userId: string): Promise<boolean> {
    try {
      await CouponModel.updateOne(
        { _id: couponId },
        {
          $inc: { usageLimit: 1 },
          $pull: { usedBy: { userId: new mongoose.Types.ObjectId(userId) } },
        }
      );

      return true;
    } catch (error: any) {
      logger.error({ error: error.message }, "CouponService::revertCouponUse()");
      return false;
    }
  }

  static async findCouponByCode(code: string): Promise<CouponDocument | null> {
    try {
      const couponCode = code.trim().toUpperCase();
      return await CouponModel.findOne({ code: couponCode, isActive: true });
    } catch (error: any) {
      logger.error({ error: error.message }, "CouponService::findCouponByCode()");
      return null;
    }
  }
}

export default CouponService;
