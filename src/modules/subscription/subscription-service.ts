import { PlanModel } from "./../plans/plans-entity";
import { GarageModel } from "./../garage/garage-entity";
import { SubscriptionModel, SubscriptionDocument, SubscriptionStatus, PaymentStatus, PlanChangeType } from "./subscription-entity";
import { GarageService } from "../garage/garage-service";
import { PlanService } from "../plans/plans-service";
import { PricingConfig } from "../../config/pricing";
import logger from "../../logger";

class SubscriptionService {
  private static readonly MIN_CHARGE_AMOUNT = PricingConfig.MIN_CHARGE_AMOUNT;

  static async createSubscription(garageId: string, planId: string, paymentMethod: string, paymentReference?: string, status: SubscriptionStatus = SubscriptionStatus.ACTIVE, paymentStatusValue: PaymentStatus = PaymentStatus.PAID, couponId?: string, interval?: string): Promise<SubscriptionDocument> {
    const garage = await GarageService.findGarageById(garageId);
    if (!garage) {
      throw new Error("Garagem não encontrada.");
    }

    const plan = await PlanService.getPlanById(planId);
    if (!plan) {
      throw new Error("Plano não encontrado.");
    }

    const startDate = new Date();
    const endDate = new Date();

    const subscriptionInterval = interval || plan.interval;

    if (subscriptionInterval === "monthly") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (subscriptionInterval === "yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    if (status === SubscriptionStatus.ACTIVE) {
      await SubscriptionModel.updateMany(
        { garageId, status: SubscriptionStatus.ACTIVE },
        {
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(),
          cancelReason: "Nova assinatura iniciada",
          updatedAt: new Date(),
        }
      ).exec();
    }

    const subscriptionData: any = {
      garageId,
      planId,
      startDate,
      endDate,
      status,
      paymentStatus: paymentStatusValue,
      paymentMethod,
      paymentReference,
      planChangeType: PlanChangeType.NEW,
      createdAt: new Date(),
    };

    if (couponId) {
      subscriptionData.couponId = couponId;
    }

    const subscription = new SubscriptionModel(subscriptionData);
    await subscription.save();

    logger.info(
      {
        subscriptionId: subscription._id,
        garageId,
        planId,
        interval: subscriptionInterval,
        endDate: endDate.toISOString(),
      },
      "Nova assinatura criada"
    );

    return subscription;
  }

  static async getActiveSubscription(garageId: string): Promise<SubscriptionDocument | null> {
    return SubscriptionModel.findOne({
      garageId,
      status: SubscriptionStatus.ACTIVE,
      endDate: { $gt: new Date() },
    }).exec();
  }

  static async cancelSubscription(subscriptionId: string, cancelReason: string): Promise<SubscriptionDocument | null> {
    return SubscriptionModel.findByIdAndUpdate(
      subscriptionId,
      {
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(),
        cancelReason,
        updatedAt: new Date(),
      },
      { new: true }
    ).exec();
  }

  static async renewSubscription(garageId: string, planId: string, paymentMethod: string, paymentReference?: string, status: SubscriptionStatus = SubscriptionStatus.ACTIVE, paymentStatusValue: PaymentStatus = PaymentStatus.PAID, couponId?: string, interval?: string): Promise<SubscriptionDocument> {
    const garage = await GarageService.findGarageById(garageId);
    if (!garage) {
      throw new Error("Garagem não encontrada.");
    }

    const plan = await PlanService.getPlanById(planId);
    if (!plan) {
      throw new Error("Plano não encontrado.");
    }

    const lastSubscription = await SubscriptionModel.findOne({ garageId }).sort({ createdAt: -1 }).exec();

    const startDate = new Date();
    const endDate = new Date();

    const subscriptionInterval = interval || plan.interval;

    if (subscriptionInterval === "monthly") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (subscriptionInterval === "yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    const isRenewal = !!lastSubscription;

    let renewalCount = 0;
    if (isRenewal) {
      renewalCount = lastSubscription.isRenewal ? (lastSubscription.renewalCount || 0) + 1 : 1;
    }

    if (status === SubscriptionStatus.ACTIVE) {
      await SubscriptionModel.updateMany(
        { garageId, status: SubscriptionStatus.ACTIVE },
        {
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(),
          cancelReason: "Nova assinatura iniciada",
          updatedAt: new Date(),
        }
      ).exec();
    }

    const subscriptionData: any = {
      garageId,
      planId,
      startDate,
      endDate,
      status,
      paymentStatus: paymentStatusValue,
      paymentMethod,
      paymentReference,
      isRenewal,
      previousSubscriptionId: isRenewal ? lastSubscription._id : undefined,
      renewalCount,
      planChangeType: PlanChangeType.RENEWAL,
      createdAt: new Date(),
    };

    if (couponId) {
      subscriptionData.couponId = couponId;
    }

    const newSubscription = new SubscriptionModel(subscriptionData);

    await newSubscription.save();

    if (status === SubscriptionStatus.ACTIVE) {
      await GarageService.updateGaragePlan(garageId, planId, endDate);
    }

    return newSubscription;
  }

  static async calculateProRatedCredit(subscription: SubscriptionDocument): Promise<number> {
    const now = new Date();
    const endDate = new Date(subscription.endDate);
    const startDate = new Date(subscription.startDate);

    const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
    const daysLeft = Math.max(0, (endDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

    if (daysLeft <= 0) return 0;

    const plan = await PlanService.getPlanById(subscription.planId.toString());
    const planPrice = plan ? plan.price : 0;

    return parseFloat(((daysLeft / totalDays) * planPrice).toFixed(2));
  }

  static async calculateUpgradeCost(garageId: string, newPlanId: string, currentSubscriptionId: string, interval?: string): Promise<any> {
    const currentSubscription = await SubscriptionModel.findById(currentSubscriptionId).exec();
    if (!currentSubscription) {
      return {
        isAllowed: false,
        message: "Assinatura atual não encontrada",
      };
    }

    const newPlan = await PlanService.getPlanById(newPlanId);
    if (!newPlan) {
      return {
        isAllowed: false,
        message: "Novo plano não encontrado",
      };
    }

    const currentPlan = await PlanService.getPlanById(currentSubscription.planId.toString());
    if (!currentPlan) {
      return {
        isAllowed: false,
        message: "Plano atual não encontrado",
      };
    }

    let newPlanEffectivePrice = newPlan.price;
    if (interval === "yearly") {
      newPlanEffectivePrice = PricingConfig.calculateAnnualPrice(newPlan.price);
    }

    if (newPlan.price <= currentPlan.price) {
      return {
        isAllowed: false,
        message: "Para upgrade, o novo plano deve ter valor superior ao plano atual.",
        changeType: "upgrade",
        currentPlan: currentPlan,
        newPlan: newPlan,
      };
    }

    const proRatedCredit = await this.calculateProRatedCredit(currentSubscription);
    let amountToPay = Math.max(0, newPlanEffectivePrice - proRatedCredit);
    const shouldCharge = amountToPay >= this.MIN_CHARGE_AMOUNT;

    if (!shouldCharge) {
      amountToPay = 0;
    }

    return {
      isAllowed: true,
      changeType: "upgrade",
      currentPlan: currentPlan,
      newPlan: newPlan,
      newPlanEffectivePrice,
      proRatedCredit,
      totalCredit: proRatedCredit,
      amountToPay,
      shouldCharge,
      interval: interval || "monthly",
    };
  }

  static async upgradePlan(garageId: string, newPlanId: string, currentSubscriptionId: string, paymentMethod: string, paymentReference?: string, status: SubscriptionStatus = SubscriptionStatus.ACTIVE, paymentStatusValue: PaymentStatus = PaymentStatus.PAID, couponId?: string, interval?: string): Promise<any> {
    const currentSubscription = await SubscriptionModel.findById(currentSubscriptionId).exec();
    if (!currentSubscription) {
      throw new Error("Assinatura atual não encontrada.");
    }

    const garage = await GarageService.findGarageById(garageId);
    if (!garage) {
      throw new Error("Garagem não encontrada.");
    }

    const newPlan = await PlanService.getPlanById(newPlanId);
    if (!newPlan) {
      throw new Error("Novo plano não encontrado.");
    }

    const currentPlanId = currentSubscription.planId.toString();
    const proRatedCredit = await this.calculateProRatedCredit(currentSubscription);

    const startDate = new Date();
    const endDate = new Date();

    const subscriptionInterval = interval || newPlan.interval;

    if (subscriptionInterval === "monthly") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (subscriptionInterval === "yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    if (status === SubscriptionStatus.ACTIVE) {
      await this.cancelSubscription(currentSubscriptionId, "Upgrade para novo plano");
    }

    const subscriptionData: any = {
      garageId,
      planId: newPlanId,
      startDate,
      endDate,
      status,
      paymentStatus: paymentStatusValue,
      paymentMethod,
      paymentReference,
      isRenewal: false,
      previousSubscriptionId: currentSubscriptionId,
      renewalCount: 0,
      planChangeType: PlanChangeType.UPGRADE,
      previousPlanId: currentPlanId,
      proRatedCredit: proRatedCredit,
      createdAt: new Date(),
    };

    if (couponId) {
      subscriptionData.couponId = couponId;
    }

    const newSubscription = new SubscriptionModel(subscriptionData);
    await newSubscription.save();

    if (status === SubscriptionStatus.ACTIVE) {
      await GarageService.updateGaragePlan(garageId, newPlanId, endDate);
    }

    return {
      isUpgraded: true,
      subscription: newSubscription,
      previousPlanId: currentPlanId,
      proRatedCredit: proRatedCredit,
    };
  }

  static async getSubscriptionHistory(garageId: string): Promise<SubscriptionDocument[]> {
    return SubscriptionModel.find({ garageId }).sort({ createdAt: -1 }).populate("planId").exec();
  }

  static async checkExpiredSubscriptions(): Promise<number> {
    const now = new Date();

    const expiredSubscriptions = await SubscriptionModel.find({
      status: SubscriptionStatus.ACTIVE,
      endDate: { $lt: now },
    }).exec();

    let updatedCount = 0;

    for (const subscription of expiredSubscriptions) {
      try {
        const garage = await GarageModel.findById(subscription.garageId).exec();
        const plan = await PlanModel.findById(subscription.planId).exec();

        await SubscriptionModel.findByIdAndUpdate(subscription._id, {
          status: SubscriptionStatus.EXPIRED,
          updatedAt: new Date(),
        }).exec();

        updatedCount++;

        logger.info(`Assinatura expirada: Garagem "${garage?.name || "Desconhecida"}" - ` + `Plano "${plan?.name || "Desconhecido"}" - ID: ${subscription._id}`);
      } catch (error) {
        logger.error({ error, subscriptionId: subscription._id }, "Erro ao processar expiração de assinatura");
      }
    }

    return updatedCount;
  }

  static async activateSubscription(subscriptionId: any): Promise<SubscriptionDocument | null> {
    try {
      const subscription = await SubscriptionModel.findById(subscriptionId).exec();

      if (!subscription) {
        logger.warn({ subscriptionId }, "Tentativa de ativar assinatura inexistente");
        return null;
      }

      if (subscription.status === SubscriptionStatus.ACTIVE) {
        logger.info({ subscriptionId }, "Assinatura já está ativa");
        return subscription;
      }

      await SubscriptionModel.updateMany(
        {
          garageId: subscription.garageId,
          status: SubscriptionStatus.ACTIVE,
          _id: { $ne: subscription._id },
        },
        {
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(),
          cancelReason: "Substituída por nova assinatura ativada",
          updatedAt: new Date(),
        }
      ).exec();

      const updatedSubscription = await SubscriptionModel.findByIdAndUpdate(
        subscription._id,
        {
          status: SubscriptionStatus.ACTIVE,
          paymentStatus: PaymentStatus.PAID,
          updatedAt: new Date(),
        },
        { new: true }
      ).exec();

      if (updatedSubscription) {
        await GarageService.updateGaragePlan(updatedSubscription.garageId.toString(), updatedSubscription.planId.toString(), updatedSubscription.endDate);

        logger.info({ subscriptionId }, "Assinatura ativada com sucesso");
      }

      return updatedSubscription;
    } catch (error: any) {
      logger.error({ error: error.message, subscriptionId }, "Erro ao ativar assinatura");
      throw error;
    }
  }
}

export default SubscriptionService;
