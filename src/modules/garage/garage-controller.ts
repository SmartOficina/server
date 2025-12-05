import { Request, Response } from "express";
import logger from "../../logger";
import { GarageService } from "./garage-service";
import AuthController from "../auth/auth-controller";
import { notificationService } from "../../core/services/notification-service";
import SubscriptionService from "../subscription/subscription-service";
import { GarageModelHandler } from "./garage-model";

const NODE_ENV = process.env.NODE_ENV || "dev";

class GarageController {
  static async listGarages(req: Request, res: Response) {
    try {
      const { search = "", limit = 10, page = 1 } = req.body;
      const { garages, totalPages } = await GarageService.listGarages(search, limit, page);
      if (garages.length === 0) {
        return res.status(404).json({ msg: "Nenhuma garagem encontrada." });
      }
      res.status(200).json({ result: garages, totalPages, msg: "Garagens listadas com sucesso." });
    } catch (error: any) {
      logger.error({ error: error.message }, "GarageController::listGarages()");
      res.status(500).json({ msg: "Erro ao listar garagens.", error: error.message });
    }
  }

  static async createGarage(req: Request, res: Response) {
    try {
      const ALLOWED_FIELDS = ["name", "cnpjCpf", "phone", "email", "password", "address"];
      const sanitizedData: any = {};

      for (const field of ALLOWED_FIELDS) {
        if (req.body[field] !== undefined) {
          sanitizedData[field] = req.body[field];
        }
      }

      if (!sanitizedData.address) {
        sanitizedData.address = {
          street: "",
          number: "",
          district: "",
          city: "",
          state: "",
          zipCode: "",
        };
      }

      sanitizedData.isRegistrationComplete = true;

      const newGarage = await GarageService.createGarage(sanitizedData);

      const token = await AuthController.generateToken({
        garageId: newGarage._id,
        email: newGarage.email,
      });

      const TRIAL_ENABLED = process.env.TRIAL_ENABLED === "true";
      const planId = req.body.planId;

      if (TRIAL_ENABLED && planId && !newGarage.trialUsed) {
        try {
          await SubscriptionService.createTrialSubscription(String(newGarage._id), planId);

          await GarageModelHandler.update(String(newGarage._id), {
            isActive: true,
            activationCode: null,
            activationCodeExpiresAt: null,
            activationAttempts: 0,
          });

          newGarage.isActive = true;
          newGarage.activationCode = undefined;
          newGarage.activationCodeExpiresAt = undefined;
          newGarage.activationAttempts = 0;

          logger.info({ garageId: newGarage._id, planId }, "Trial criado e conta ativada automaticamente");
        } catch (trialError: any) {
          logger.error({ error: trialError.message, garageId: newGarage._id }, "Erro ao criar trial");
        }
      }

      await notificationService.sendAccountCreatedNotification(newGarage.name, newGarage.email, String(newGarage._id), newGarage.phone, newGarage.cnpjCpf, newGarage.address ? `${newGarage.address.city}, ${newGarage.address.state}` : undefined);

      res.status(200).json({
        result: newGarage,
        token: token,
        garage: newGarage,
        msg: "Garagem criada com sucesso.",
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "GarageController::createGarage()");
      res.status(500).json({ msg: error.message || "Erro ao criar garagem." });
    }
  }

  static async editGarage(req: Request, res: Response) {
    try {
      const { id, ...updateData } = req.body;
      if (!id) return res.status(400).json({ msg: 'O campo "id" é obrigatório para editar a garagem.' });
      const updatedGarage = await GarageService.editGarage(id, updateData);
      if (!updatedGarage) {
        return res.status(404).json({ msg: "Garagem não encontrada." });
      }
      res.status(200).json({ result: updatedGarage, msg: "Garagem editada com sucesso." });
    } catch (error: any) {
      logger.error({ error: error.message }, "GarageController::editGarage()");
      res.status(500).json({ msg: error.message || "Erro ao editar garagem." });
    }
  }

  static async removeGarage(req: Request, res: Response) {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ msg: 'O campo "id" é obrigatório para remover a garagem.' });
      const success = await GarageService.removeGarage(id);
      if (success) {
        res.status(200).json({ msg: "Garagem removida com sucesso." });
      } else {
        res.status(404).json({ msg: "Garagem não encontrada." });
      }
    } catch (error: any) {
      logger.error({ error: error.message }, "GarageController::removeGarage()");
      res.status(500).json({ msg: error.message || "Erro ao remover garagem." });
    }
  }

  static async checkPhone(req: Request, res: Response) {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json({ msg: 'O campo "phone" é obrigatório.' });
      const exists = await GarageService.checkPhone(phone);
      res.status(200).json({ exists });
    } catch (error: any) {
      logger.error({ error: error.message }, "GarageController::checkPhone()");
      res.status(500).json({ msg: error.message || "Erro ao verificar celular." });
    }
  }

  static async checkEmail(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ msg: 'O campo "email" é obrigatório.' });
      const exists = await GarageService.checkEmail(email);
      res.status(200).json({ exists });
    } catch (error: any) {
      logger.error({ error: error.message }, "GarageController::checkEmail()");
      res.status(500).json({ msg: error.message || "Erro ao verificar e-mail." });
    }
  }

  static async checkCnpjCpf(req: Request, res: Response) {
    try {
      const { cnpjCpf } = req.body;
      if (!cnpjCpf) return res.status(400).json({ msg: 'O campo "cnpjCpf" é obrigatório.' });
      const exists = await GarageService.checkCnpjCpf(cnpjCpf);
      res.status(200).json({ exists });
    } catch (error: any) {
      logger.error({ error: error.message }, "GarageController::checkCnpjCpf()");
      res.status(500).json({ msg: error.message || "Erro ao verificar CNPJ/CPF." });
    }
  }

  static async handleCodeVerification(req: Request, res: Response) {
    try {
      const { email, code, context } = req.body;
      if (!email || !code || !context) {
        return res.status(400).json({ msg: 'Os campos "email", "code" e "context" são obrigatórios.' });
      }
      const result = await GarageService.verifyCode(email, code, context);
      if (context === "activation" && result.token && result.garage) {
        return res.status(200).json({
          msg: "Conta ativada com sucesso.",
          token: result.token,
          garage: result.garage,
        });
      }
      res.status(200).json({ msg: "Código verificado com sucesso." });
    } catch (error: any) {
      logger.error({ error: error.message }, "GarageController::handleCodeVerification()");
      res.status(500).json({ msg: error.message || "Erro ao verificar código." });
    }
  }

  static async handleCodeResend(req: Request, res: Response) {
    try {
      const { email, context } = req.body;
      if (!email || !context) {
        return res.status(400).json({ msg: 'Os campos "email" e "context" são obrigatórios.' });
      }
      await GarageService.resendCode(email, context);
      res.status(200).json({ msg: "Código enviado ao e-mail." });
    } catch (error: any) {
      logger.error({ error: error.message }, "GarageController::handleCodeResend()");
      res.status(400).json({ msg: error.message || "Erro ao reenviar código." });
    }
  }

  static async resendActivationMagicLink(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ msg: 'O campo "email" é obrigatório.' });
      }
      await GarageService.resendActivationMagicLink(email);
      res.status(200).json({ msg: "Link de ativação enviado ao e-mail." });
    } catch (error: any) {
      logger.error({ error: error.message }, "GarageController::resendActivationMagicLink()");
      res.status(400).json({ msg: error.message || "Erro ao reenviar link de ativação." });
    }
  }

  static async sendActivationEmail(req: Request, res: Response) {
    try {
      const { garageId } = req.body;
      if (!garageId) {
        return res.status(400).json({ msg: "ID da garagem é obrigatório." });
      }
      await GarageService.sendActivationEmail(garageId);
      res.status(200).json({ msg: "E-mail de ativação enviado com sucesso." });
    } catch (error: any) {
      logger.error({ error: error.message }, "GarageController::sendActivationEmail()");
      res.status(400).json({ msg: error.message || "Erro ao enviar e-mail de ativação." });
    }
  }

  static async activateViaToken(req: Request, res: Response) {
    try {
      const { token } = req.params;
      if (!token) {
        return res.status(400).json({ msg: "Token de ativação é obrigatório." });
      }

      const result = await GarageService.activateViaToken(token);

      if (result.success) {
        return res.redirect(`${NODE_ENV === "prod" ? "https://smartoficina.com.br" : "http://localhost:4200"}/system?activated=true&token=${result.authToken}&email=${encodeURIComponent(result.garage.email)}`);
      } else {
        return res.redirect(`${NODE_ENV === "prod" ? "https://smartoficina.com.br" : "http://localhost:4200"}/activation-error?message=${encodeURIComponent(result.message || "Erro na ativação")}`);
      }
    } catch (error: any) {
      logger.error({ error: error.message }, "GarageController::activateViaToken()");
      return res.redirect(`${NODE_ENV === "prod" ? "https://smartoficina.com.br" : "http://localhost:4200"}/activation-error?message=${encodeURIComponent("Erro interno do servidor")}`);
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const { email, code, newPassword } = req.body;

      if (!email || !code || !newPassword) {
        return res.status(400).json({
          msg: 'Os campos "email", "code" e "newPassword" são obrigatórios.',
        });
      }

      const verified = await GarageService.verifyCode(email, code, "password_reset");

      if (!verified) {
        return res.status(400).json({ msg: "Código inválido ou expirado." });
      }

      const result = await GarageService.resetPassword(email, newPassword);

      if (result.token && result.garage) {
        return res.status(200).json({
          msg: "Senha redefinida com sucesso.",
          token: result.token,
          garage: result.garage,
        });
      } else {
        return res.status(500).json({ msg: "Erro ao redefinir senha." });
      }
    } catch (error: any) {
      logger.error({ error: error.message }, "GarageController::resetPassword()");
      res.status(500).json({ msg: error.message || "Erro ao redefinir senha." });
    }
  }
}

export default GarageController;
