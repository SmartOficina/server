import { emailService } from "./../../core/middleware/services/email-service";
import { Request, Response } from "express";
import logger from "../../logger";
import { notificationService } from "../../core/services/notification-service";
import { GarageService } from "../garage/garage-service";
import { PlanService } from "../plans/plans-service";
import SubscriptionService from "../subscription/subscription-service";
import AsaasPayment, { CreditCardData, CreditCardHolderInfo } from "../../core/services/asaas-payment";
import CreditCardTokenService from "../credit-card/credit-card-service";
import { SubscriptionModel, SubscriptionStatus, PaymentStatus } from "../subscription/subscription-entity";
import { GarageDocument } from "../garage/garage-entity";
import CouponService from "../coupon/coupon-service";
import { CouponDocument } from "../coupon/coupon-entity";
import { PricingConfig } from "../../config/pricing";

class PaymentController {
  private static readonly MIN_CHARGE_AMOUNT = PricingConfig.MIN_CHARGE_AMOUNT;

  static async processPayment(req: Request, res: Response) {
    let coupon: CouponDocument | null = null;
    let plan = null;
    let planId;
    let couponCode;

    try {
      const { planId: requestPlanId, garageId, paymentData, couponCode: requestCouponCode, interval } = req.body;

      planId = requestPlanId;
      couponCode = requestCouponCode;

      if (!planId) {
        return res.status(400).json({ msg: "ID do plano é obrigatório." });
      }

      if (!garageId) {
        return res.status(400).json({ msg: "ID da garagem é obrigatório." });
      }

      const plan = await PlanService.getPlanById(planId);
      if (!plan) {
        return res.status(404).json({ msg: "Plano não encontrado." });
      }

      const garage: any = await GarageService.findGarageById(garageId);
      if (!garage) {
        return res.status(404).json({ msg: "Garagem não encontrada." });
      }

      let basePrice = plan.price;
      if (interval === "yearly") {
        basePrice = PricingConfig.calculateAnnualPrice(plan.price);
      }

      let finalPrice = basePrice;
      let couponValidation = null;
      let coupon = null;

      if (couponCode) {
        couponValidation = await CouponService.validateCoupon(String(couponCode), String(planId), interval || "monthly");

        if (!couponValidation.valid || !couponValidation.coupon) {
          return res.status(400).json({
            msg: couponValidation.message || "Cupom inválido.",
          });
        }

        coupon = couponValidation.coupon;

        finalPrice = CouponService.calculateDiscountedPrice(basePrice, coupon);
      }

      if (coupon && coupon.discount === 100) {
        const couponUsed = await CouponService.reserveCouponUse(String(coupon._id), garageId);
        if (!couponUsed) {
          logger.warn({ couponId: coupon._id }, "Não foi possível decrementar o uso do cupom para assinatura gratuita");
        }

        const subscription = await SubscriptionService.createSubscription(garage._id, planId, "free_coupon", "free_with_coupon", SubscriptionStatus.ACTIVE, PaymentStatus.PAID, String(coupon._id), interval || "monthly");

        const expirationDate = subscription.endDate;
        await GarageService.updateGaragePlan(garage._id, planId, expirationDate);

        if (!garage.isActive) {
          await GarageService.editGarage(garage._id, { isActive: true });
          logger.info(`Garage ${garage._id} activated after free coupon payment`, 'PaymentController::processPayment()');
        }

        const planDetails = await PlanService.getPlanById(planId);
        if (planDetails) {
          await emailService.sendNewSubscriptionEmail(garage.email, planDetails.name, subscription.endDate, true);
          
          // Notificação para assinatura gratuita
          const action = subscription.isRenewal ? 'renovacao' : 'nova';
          await notificationService.sendSubscriptionNotification(
            garage.name,
            planDetails.name,
            action,
            0 // valor 0 para assinatura gratuita
          );
        }

        return res.status(200).json({
          msg: "Sua assinatura gratuita foi ativada com sucesso!",
          subscription: {
            id: subscription._id,
            planId: subscription.planId,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            status: subscription.status,
          },
          coupon: coupon
            ? {
                id: coupon._id,
                code: coupon.code,
                discount: coupon.discount,
                savings: basePrice,
              }
            : null,
        });
      }

      if (!paymentData?.method) {
        return res.status(400).json({ msg: "Método de pagamento é obrigatório." });
      }

      const customerId = await AsaasPayment.createOrGetCustomer(garage);

      let paymentResult;
      const planDescription = interval === "yearly" ? `Assinatura anual do plano ${plan.name}` : `Assinatura do plano ${plan.name}`;
      let subscriptionStatus = SubscriptionStatus.ACTIVE;
      let paymentStatusValue = PaymentStatus.PAID;

      if (paymentData.method === "credit_card") {
        if (paymentData.savedCardId) {
          const savedCards = await CreditCardTokenService.getCardsByGarageId(garage._id);
          const selectedCard = savedCards.find((card: any) => card._id.toString() === paymentData.savedCardId);

          if (!selectedCard) {
            return res.status(404).json({ msg: "Cartão salvo não encontrado." });
          }

          paymentResult = await AsaasPayment.createPaymentWithToken(customerId, finalPrice, planDescription, selectedCard.token, planId, paymentData.cvv);
        } else if (paymentData.creditCardToken) {
          if (!paymentData.cvv) {
            return res.status(400).json({ msg: "CVV é obrigatório para pagamento com token de cartão." });
          }

          paymentResult = await AsaasPayment.createPaymentWithToken(customerId, finalPrice, planDescription, paymentData.creditCardToken, planId, paymentData.cvv);
        } else {
          if (!validateCreditCardData(paymentData.creditCard)) {
            return res.status(400).json({ msg: "Dados do cartão inválidos ou incompletos." });
          }

          const holderInfo = extractHolderInfoFromGarage(garage);
          paymentResult = await AsaasPayment.createCreditCardPayment(customerId, finalPrice, planDescription, paymentData.creditCard as CreditCardData, holderInfo, planId, garage._id);
        }
      } else if (paymentData.method === "pix") {
        paymentResult = await AsaasPayment.createPixPayment(customerId, finalPrice, planDescription, planId);

        subscriptionStatus = SubscriptionStatus.PENDING;
        paymentStatusValue = PaymentStatus.PENDING;
      } else {
        return res.status(400).json({ msg: "Método de pagamento não suportado." });
      }

      if (paymentResult.status === "CONFIRMED" || paymentResult.status === "PENDING") {
        if (coupon) {
          const couponUsed = await CouponService.reserveCouponUse(String(coupon._id), garageId);
          if (!couponUsed) {
            logger.warn({ couponId: coupon._id }, "Não foi possível decrementar o uso do cupom, mas o pagamento já foi processado");
          }
        }

        let subscription;

        if (coupon) {
          subscription = await SubscriptionService.createSubscription(garage._id, planId, paymentData.method, paymentResult.paymentId, subscriptionStatus, paymentStatusValue, String(coupon._id), interval || "monthly");
        } else {
          subscription = await SubscriptionService.createSubscription(garage._id, planId, paymentData.method, paymentResult.paymentId, subscriptionStatus, paymentStatusValue, undefined, interval || "monthly");
        }

        if (subscriptionStatus === SubscriptionStatus.ACTIVE) {
          const expirationDate = subscription.endDate;
          await GarageService.updateGaragePlan(garage._id, planId, expirationDate);

          if (!garage.isActive) {
            await GarageService.editGarage(garage._id, { isActive: true });
            logger.info(`Garage ${garage._id} activated after successful payment`, 'PaymentController::processPayment()');
          }

          const planDetails = await PlanService.getPlanById(planId);
          const isFree = coupon ? coupon.discount === 100 : false;

          if (planDetails) {
            await emailService.sendNewSubscriptionEmail(garage.email, planDetails.name, subscription.endDate, isFree);
            
            // Notificação para pagamentos confirmados imediatamente (cartão de crédito)
            const action = subscription.isRenewal ? 'renovacao' : 'nova';
            await notificationService.sendSubscriptionNotification(
              garage.name,
              planDetails.name,
              action,
              finalPrice
            );
          }
        }

        return res.status(200).json({
          msg: paymentData.method === "pix" ? "QR Code PIX gerado. Aguardando pagamento." : "Pagamento processado com sucesso.",
          subscription: {
            id: subscription._id,
            planId: subscription.planId,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            status: subscription.status,
          },
          payment: {
            id: paymentResult.paymentId,
            status: paymentResult.status,
            invoiceUrl: paymentResult.invoiceUrl,
            pixQrCode: paymentResult.pixQrCode,
            pixCopiaECola: paymentResult.pixCopiaECola,
            expirationDate: paymentResult.expirationDate,
            savedCard: paymentResult.creditCardToken
              ? {
                  token: paymentResult.creditCardToken,
                  brand: paymentResult.cardBrand,
                  lastDigits: paymentResult.cardNumber ? paymentResult.cardNumber.slice(-4) : null,
                }
              : null,
          },
          coupon: coupon
            ? {
                id: coupon._id,
                code: coupon.code,
                discount: coupon.discount,
                savings: basePrice - finalPrice,
              }
            : null,
        });
      } else {
        return res.status(400).json({
          msg: "Falha no processamento do pagamento.",
          paymentStatus: paymentResult.status,
        });
      }
    } catch (error: any) {
      logger.error({ error: error.message }, "PaymentController::processPayment()");
      res.status(500).json({ msg: "Erro ao processar pagamento.", error: error.message });
    }
  }

  static async renewSubscription(req: Request, res: Response) {
    try {
      const { garageId, planId, paymentData, couponCode, interval } = req.body;

      if (!garageId || !planId) {
        return res.status(400).json({ msg: "ID da garagem e ID do plano são obrigatórios." });
      }

      const plan = await PlanService.getPlanById(planId);
      if (!plan) {
        return res.status(404).json({ msg: "Plano não encontrado." });
      }

      const garage = await GarageService.findGarageById(garageId);
      if (!garage) {
        return res.status(404).json({ msg: "Garagem não encontrada." });
      }

  
      let basePrice = plan.price;
      if (interval === "yearly") {
        basePrice = PricingConfig.calculateAnnualPrice(plan.price);
      }

      let finalPrice = basePrice;
      let coupon = null;

      if (couponCode) {
        const couponValidation = await CouponService.validateCoupon(String(couponCode), String(planId), interval || "monthly");

        if (!couponValidation.valid || !couponValidation.coupon) {
          return res.status(400).json({
            msg: couponValidation.message || "Cupom inválido.",
          });
        }

        coupon = couponValidation.coupon;
        finalPrice = CouponService.calculateDiscountedPrice(basePrice, coupon);
      }

      if (coupon && coupon.discount === 100) {
        const couponUsed = await CouponService.reserveCouponUse(String(coupon._id), garageId);
        if (!couponUsed) {
          logger.warn({ couponId: coupon._id }, "Não foi possível decrementar o uso do cupom para renovação gratuita");
        }

        const subscription = await SubscriptionService.renewSubscription(garageId, planId, "free_coupon", "free_with_coupon", SubscriptionStatus.ACTIVE, PaymentStatus.PAID, String(coupon._id), interval || "monthly");

        const expirationDate = subscription.endDate;
        await GarageService.updateGaragePlan(garageId, planId, expirationDate);

        await emailService.sendRenewalEmail(garage.email, plan.name, subscription.endDate, true);
        
        // Notificação para renovação gratuita
        await notificationService.sendSubscriptionNotification(
          garage.name,
          plan.name,
          'renovacao',
          0 // valor 0 para renovação gratuita
        );

        return res.status(200).json({
          msg: "Sua assinatura foi renovada com sucesso!",
          subscription: {
            id: subscription._id,
            planId: subscription.planId,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            status: subscription.status,
            isRenewal: subscription.isRenewal,
            renewalCount: subscription.renewalCount,
          },
          coupon: coupon
            ? {
                id: coupon._id,
                code: coupon.code,
                discount: coupon.discount,
                savings: basePrice,
              }
            : null,
        });
      }

      if (!paymentData?.method) {
        return res.status(400).json({ msg: "Método de pagamento é obrigatório." });
      }

      const customerId = await AsaasPayment.createOrGetCustomer(garage);

      let paymentResult;
      const planDescription = interval === "yearly" ? `Renovação anual do plano ${plan.name}` : `Renovação do plano ${plan.name}`;
      let subscriptionStatus = SubscriptionStatus.ACTIVE;
      let paymentStatusValue = PaymentStatus.PAID;

      if (paymentData.method === "credit_card") {
        if (paymentData.savedCardId) {
          const savedCards = await CreditCardTokenService.getCardsByGarageId(garageId);
          const selectedCard = savedCards.find((card: any) => card._id.toString() === paymentData.savedCardId);

          if (!selectedCard) {
            return res.status(404).json({ msg: "Cartão salvo não encontrado." });
          }

          paymentResult = await AsaasPayment.createPaymentWithToken(customerId, finalPrice, planDescription, selectedCard.token, planId, paymentData.cvv);
        } else if (paymentData.creditCardToken) {
          if (!paymentData.cvv) {
            return res.status(400).json({ msg: "CVV é obrigatório para pagamento com token de cartão." });
          }

          paymentResult = await AsaasPayment.createPaymentWithToken(customerId, finalPrice, planDescription, paymentData.creditCardToken, planId, paymentData.cvv);
        } else {
          if (!validateCreditCardData(paymentData.creditCard)) {
            return res.status(400).json({ msg: "Dados do cartão inválidos ou incompletos." });
          }

          const holderInfo = extractHolderInfoFromGarage(garage);
          paymentResult = await AsaasPayment.createCreditCardPayment(customerId, finalPrice, planDescription, paymentData.creditCard as CreditCardData, holderInfo, planId, garageId);
        }
      } else if (paymentData.method === "pix") {
        paymentResult = await AsaasPayment.createPixPayment(customerId, finalPrice, planDescription, planId);

        subscriptionStatus = SubscriptionStatus.PENDING;
        paymentStatusValue = PaymentStatus.PENDING;
      } else {
        return res.status(400).json({ msg: "Método de pagamento não suportado." });
      }

      if (paymentResult.status === "CONFIRMED" || paymentResult.status === "PENDING") {
        if (coupon) {
          const couponUsed = await CouponService.reserveCouponUse(String(coupon._id), garageId);
          if (!couponUsed) {
            logger.warn({ couponId: coupon._id }, "Não foi possível decrementar o uso do cupom para renovação, mas o pagamento já foi processado");
          }
        }

        const subscription = await SubscriptionService.renewSubscription(garageId, planId, paymentData.method, paymentResult.paymentId, subscriptionStatus, paymentStatusValue, coupon ? String(coupon._id) : undefined, interval || "monthly");

        if (subscriptionStatus === SubscriptionStatus.ACTIVE) {
          const expirationDate = subscription.endDate;
          await GarageService.updateGaragePlan(garageId, planId, expirationDate);

          const isFree = coupon ? coupon.discount === 100 : false;

          await emailService.sendRenewalEmail(garage.email, plan.name, subscription.endDate, isFree);
          
          // Notificação para renovações confirmadas imediatamente (cartão de crédito)  
          await notificationService.sendSubscriptionNotification(
            garage.name,
            plan.name,
            'renovacao',
            finalPrice
          );
        }

        return res.status(200).json({
          msg: paymentData.method === "pix" ? "QR Code PIX gerado. Aguardando pagamento." : "Assinatura renovada com sucesso.",
          subscription: {
            id: subscription._id,
            planId: subscription.planId,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            status: subscription.status,
            isRenewal: subscription.isRenewal,
            renewalCount: subscription.renewalCount,
          },
          payment: {
            id: paymentResult.paymentId,
            status: paymentResult.status,
            invoiceUrl: paymentResult.invoiceUrl,
            pixQrCode: paymentResult.pixQrCode,
            pixCopiaECola: paymentResult.pixCopiaECola,
            expirationDate: paymentResult.expirationDate,
            savedCard: paymentResult.creditCardToken
              ? {
                  token: paymentResult.creditCardToken,
                  brand: paymentResult.cardBrand,
                  lastDigits: paymentResult.cardNumber ? paymentResult.cardNumber.slice(-4) : null,
                }
              : null,
          },
          coupon: coupon
            ? {
                id: coupon._id,
                code: coupon.code,
                discount: coupon.discount,
                savings: basePrice - finalPrice,
              }
            : null,
        });
      } else {
        return res.status(400).json({
          msg: "Falha no processamento do pagamento para renovação.",
          paymentStatus: paymentResult.status,
        });
      }
    } catch (error: any) {
      logger.error({ error: error.message }, "PaymentController::renewSubscription()");
      res.status(500).json({ msg: "Erro ao renovar assinatura.", error: error.message });
    }
  }

  static async upgradePlan(req: Request, res: Response) {
    try {
      const { garageId, newPlanId, currentSubscriptionId, paymentData, couponCode, interval } = req.body;

      if (!garageId || !newPlanId || !currentSubscriptionId) {
        return res.status(400).json({
          msg: "ID da garagem, ID do novo plano e ID da assinatura atual são obrigatórios.",
        });
      }

      const upgradePreview = await SubscriptionService.calculateUpgradeCost(garageId, newPlanId, currentSubscriptionId, interval);

      if (!upgradePreview.isAllowed) {
        return res.status(400).json({
          msg: upgradePreview.message || "Upgrade não permitido.",
          isAllowed: false,
        });
      }

      const garage = await GarageService.findGarageById(garageId);
      if (!garage) {
        return res.status(404).json({ msg: "Garagem não encontrada." });
      }

      let coupon = null;
      let finalAmountToPay = upgradePreview.amountToPay;

      if (couponCode) {
        const couponValidation = await CouponService.validateCoupon(String(couponCode), String(newPlanId), interval || "monthly");

        if (!couponValidation.valid || !couponValidation.coupon) {
          return res.status(400).json({
            msg: couponValidation.message || "Cupom inválido.",
          });
        }

        coupon = couponValidation.coupon;

        const discountAmount = (upgradePreview.amountToPay * coupon.discount) / 100;
        finalAmountToPay = Math.max(0, upgradePreview.amountToPay - discountAmount);

        upgradePreview.shouldCharge = finalAmountToPay >= this.MIN_CHARGE_AMOUNT;
      }

      if ((coupon && coupon.discount === 100) || !upgradePreview.shouldCharge) {
        if (coupon) {
          const couponUsed = await CouponService.reserveCouponUse(String(coupon._id), garageId);
          if (!couponUsed) {
            logger.warn({ couponId: coupon._id }, "Não foi possível decrementar o uso do cupom para upgrade gratuito");
          }
        }

        const result = await SubscriptionService.upgradePlan(garageId, newPlanId, currentSubscriptionId, "free_coupon", "upgrade_free", SubscriptionStatus.ACTIVE, PaymentStatus.PAID, coupon ? String(coupon._id) : undefined, interval || "monthly");

        await GarageService.updateGaragePlan(garageId, newPlanId, result.subscription.endDate);

        const newPlan = await PlanService.getPlanById(newPlanId);
        const oldPlan = await PlanService.getPlanById(result.previousPlanId);

        if (newPlan && oldPlan) {
          await emailService.sendUpgradeEmail(garage.email, oldPlan.name, newPlan.name, result.subscription.endDate, true);
          
          // Notificação para upgrade gratuito
          await notificationService.sendSubscriptionNotification(
            garage.name,
            newPlan.name,
            'nova', // upgrade é tratado como nova assinatura
            0 // valor 0 para upgrade gratuito
          );
        }

        return res.status(200).json({
          msg: "Upgrade de plano realizado com sucesso sem cobrança adicional.",
          subscription: {
            id: result.subscription._id,
            planId: result.subscription.planId,
            startDate: result.subscription.startDate,
            endDate: result.subscription.endDate,
            status: result.subscription.status,
          },
          billing: {
            oldPlan: oldPlan,
            newPlan: newPlan,
            proRatedCredit: result.proRatedCredit,
            amountPaid: 0,
            shouldCharge: false,
          },
          coupon: coupon
            ? {
                id: coupon._id,
                code: coupon.code,
                discount: coupon.discount,
                savings: upgradePreview.amountToPay - finalAmountToPay,
              }
            : null,
        });
      }

      if (!paymentData?.method) {
        return res.status(400).json({ msg: "Método de pagamento é obrigatório para cobranças." });
      }

      logger.info({ 
        garageId: garage._id, 
        garageName: garage.name, 
        garageEmail: garage.email,
        garageCnpjCpf: garage.cnpjCpf 
      }, "Criando customer para upgrade PIX");
      
      const customerId = await AsaasPayment.createOrGetCustomer(garage);
      
      if (!customerId || customerId.trim() === '') {
        logger.error({ 
          garageId: garage._id, 
          customerId 
        }, "Customer ID inválido ou vazio");
        return res.status(500).json({ msg: "Erro ao criar customer no sistema de pagamento." });
      }
      
      logger.info({ 
        garageId: garage._id, 
        customerId 
      }, "Customer criado/obtido para upgrade PIX");

      let paymentResult;
      const planDescription = interval === "yearly" ? `Upgrade anual para plano ${upgradePreview.newPlan.name}` : `Upgrade para plano ${upgradePreview.newPlan.name}`;
      let subscriptionStatus = SubscriptionStatus.ACTIVE;
      let paymentStatusValue = PaymentStatus.PAID;

      if (paymentData.method === "credit_card") {
        if (paymentData.savedCardId) {
          const savedCards = await CreditCardTokenService.getCardsByGarageId(garageId);
          const selectedCard = savedCards.find((card: any) => card._id.toString() === paymentData.savedCardId);

          if (!selectedCard) {
            return res.status(404).json({ msg: "Cartão salvo não encontrado." });
          }

          paymentResult = await AsaasPayment.createPaymentWithToken(customerId, finalAmountToPay, planDescription, selectedCard.token, newPlanId, paymentData.cvv);
        } else if (paymentData.creditCardToken) {
          if (!paymentData.cvv) {
            return res.status(400).json({ msg: "CVV é obrigatório para pagamento com token de cartão." });
          }

          paymentResult = await AsaasPayment.createPaymentWithToken(customerId, finalAmountToPay, planDescription, paymentData.creditCardToken, newPlanId, paymentData.cvv);
        } else {
          if (!validateCreditCardData(paymentData.creditCard)) {
            return res.status(400).json({ msg: "Dados do cartão inválidos ou incompletos." });
          }

          const holderInfo = extractHolderInfoFromGarage(garage);
          paymentResult = await AsaasPayment.createCreditCardPayment(customerId, finalAmountToPay, planDescription, paymentData.creditCard as CreditCardData, holderInfo, newPlanId, garageId);
        }
      } else if (paymentData.method === "pix") {
        paymentResult = await AsaasPayment.createPixPayment(customerId, finalAmountToPay, planDescription, newPlanId);

        subscriptionStatus = SubscriptionStatus.PENDING;
        paymentStatusValue = PaymentStatus.PENDING;
      } else {
        return res.status(400).json({ msg: "Método de pagamento não suportado." });
      }

      if (paymentResult.status === "CONFIRMED" || paymentResult.status === "PENDING") {
        if (coupon) {
          const couponUsed = await CouponService.reserveCouponUse(String(coupon._id), garageId);
          if (!couponUsed) {
            logger.warn({ couponId: coupon._id }, "Não foi possível decrementar o uso do cupom para upgrade, mas o pagamento já foi processado");
          }
        }

        const result = await SubscriptionService.upgradePlan(garageId, newPlanId, currentSubscriptionId, paymentData.method, paymentResult.paymentId, subscriptionStatus, paymentStatusValue, coupon ? String(coupon._id) : undefined, interval || "monthly");

        const newPlan = await PlanService.getPlanById(newPlanId);
        const oldPlan = await PlanService.getPlanById(result.previousPlanId);

        if (subscriptionStatus === SubscriptionStatus.ACTIVE) {
          await GarageService.updateGaragePlan(garageId, newPlanId, result.subscription.endDate);

          const isFree = (coupon ? coupon.discount === 100 : false) || !upgradePreview.shouldCharge;

          if (newPlan && oldPlan) {
            await emailService.sendUpgradeEmail(garage.email, oldPlan.name, newPlan.name, result.subscription.endDate, isFree);
          }
        }

        return res.status(200).json({
          msg: paymentData.method === "pix" ? "QR Code PIX gerado. Aguardando pagamento para finalizar upgrade." : "Upgrade de plano realizado com sucesso.",
          subscription: {
            id: result.subscription._id,
            planId: result.subscription.planId,
            startDate: result.subscription.startDate,
            endDate: result.subscription.endDate,
            status: result.subscription.status,
          },
          payment: {
            id: paymentResult.paymentId,
            status: paymentResult.status,
            invoiceUrl: paymentResult.invoiceUrl,
            pixQrCode: paymentResult.pixQrCode,
            pixCopiaECola: paymentResult.pixCopiaECola,
            expirationDate: paymentResult.expirationDate,
            savedCard: paymentResult.creditCardToken
              ? {
                  token: paymentResult.creditCardToken,
                  brand: paymentResult.cardBrand,
                  lastDigits: paymentResult.cardNumber ? paymentResult.cardNumber.slice(-4) : null,
                }
              : null,
          },
          billing: {
            oldPlan: oldPlan,
            newPlan: newPlan,
            proRatedCredit: result.proRatedCredit,
            amountPaid: finalAmountToPay,
            shouldCharge: true,
          },
          coupon: coupon
            ? {
                id: coupon._id,
                code: coupon.code,
                discount: coupon.discount,
                savings: upgradePreview.amountToPay - finalAmountToPay,
              }
            : null,
        });
      } else {
        return res.status(400).json({
          msg: "Falha no processamento do pagamento para upgrade.",
          paymentStatus: paymentResult.status,
        });
      }
    } catch (error: any) {
      logger.error({ error: error.message }, "PaymentController::upgradePlan()");
      res.status(500).json({ msg: "Erro ao processar upgrade de plano.", error: error.message });
    }
  }

  static async verifyPlanChange(req: Request, res: Response) {
    try {
      const { garageId, newPlanId, currentSubscriptionId, changeType, interval } = req.body;

      if (!garageId || !newPlanId || !currentSubscriptionId || !changeType) {
        return res.status(400).json({
          msg: "Todos os parâmetros são obrigatórios: garageId, newPlanId, currentSubscriptionId, changeType.",
        });
      }

      if (changeType === "upgrade") {
        const upgradePreview = await SubscriptionService.calculateUpgradeCost(garageId, newPlanId, currentSubscriptionId, interval);

        return res.status(200).json(upgradePreview);
      } else if (changeType === "downgrade") {
        return res.status(400).json({
          msg: "Downgrade de plano não é permitido. Por favor, espere a assinatura atual expirar antes de assinar um plano de menor valor.",
          isAllowed: false,
          changeType: "downgrade",
        });
      } else {
        return res.status(400).json({
          msg: 'Tipo de mudança não reconhecido. Use "upgrade" ou "downgrade".',
          isAllowed: false,
        });
      }
    } catch (error: any) {
      logger.error({ error: error.message }, "PaymentController::verifyPlanChange()");
      res.status(500).json({
        msg: "Erro ao verificar mudança de plano.",
        error: error.message,
        isAllowed: false,
      });
    }
  }

  static async checkPaymentStatus(req: Request, res: Response) {
    try {
      const { paymentId } = req.params;

      if (!paymentId) {
        return res.status(400).json({ msg: "ID do pagamento é obrigatório." });
      }

      const subscription = await SubscriptionModel.findOne({ paymentReference: paymentId }).exec();

      if (!subscription) {
        return res.status(404).json({ msg: "Pagamento não encontrado." });
      }

      let asaasPaymentStatus = null;
      try {
        asaasPaymentStatus = await AsaasPayment.getPaymentStatus(paymentId);
      } catch (error: any) {
        logger.warn({ error: error.message, paymentId }, "Erro ao consultar status do pagamento no Asaas");
      }

      if (asaasPaymentStatus === "RECEIVED" && subscription.status === SubscriptionStatus.PENDING) {
        await SubscriptionService.activateSubscription(subscription._id?.toString() || '');
        
        const garage = await GarageService.findGarageById(subscription.garageId.toString());
        if (garage && !garage.isActive) {
          await GarageService.editGarage(garage._id?.toString() || '', { isActive: true });
          const expirationDate = subscription.endDate;
          await GarageService.updateGaragePlan(garage._id?.toString() || '', subscription.planId.toString(), expirationDate);
          logger.info(`Garage ${garage._id} activated after PIX payment confirmation`, 'PaymentController::checkPaymentStatus()');
        }
      }

      const paymentStatus = {
        id: paymentId,
        status: subscription.status,
        paymentStatus: subscription.paymentStatus,
        asaasStatus: asaasPaymentStatus,
        garageId: subscription.garageId,
        planId: subscription.planId,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        createdAt: subscription.createdAt,
      };

      return res.status(200).json({ result: paymentStatus });
    } catch (error: any) {
      logger.error({ error: error.message }, "PaymentController::checkPaymentStatus()");
      res.status(500).json({ msg: "Erro ao verificar status do pagamento.", error: error.message });
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
      logger.error({ error: error.message }, "PaymentController::getPlanForCoupon()");
      res.status(500).json({ msg: "Erro ao buscar plano para o cupom.", error: error.message });
    }
  }

}

function validateCreditCardData(creditCard: any): boolean {
  if (!creditCard) return false;

  return !!(creditCard.holderName && creditCard.number && creditCard.expiryMonth && creditCard.expiryYear && creditCard.ccv);
}

function extractHolderInfoFromGarage(garage: GarageDocument): CreditCardHolderInfo {
  return {
    name: garage.name,
    email: garage.email,
    cpfCnpj: garage.cnpjCpf,
    postalCode: garage.address?.zipCode,
    addressNumber: garage.address?.number,
    phone: garage.phone,
  };
}

export default PaymentController;
