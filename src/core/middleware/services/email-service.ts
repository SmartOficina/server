import nodemailer from "nodemailer";
import dotenv from "dotenv";
import logger from "../../../logger";

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'dev';
const emailUser = process.env.EMAIL_USER;
const emailPassword = process.env.EMAIL_PASSWORD;
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';

class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: "smtp.zoho.com",
      port: 465,
      secure: true,
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });
  }

  async sendGenericEmail(email: string, subject: string, headerTitle: string, message: string, code: string): Promise<void> {
    if (!EMAIL_ENABLED) {
      logger.info({ email, subject }, 'Email desabilitado - não enviando email');
      return;
    }

    const mailOptions = {
      from: `"Smart Oficina" <${emailUser}>`,
      to: email,
      subject: subject,
      html: `
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${headerTitle}</title>
                    <style>
                        body {
                            font-family: 'Arial', sans-serif;
                            background-color: #f8f9fa;
                            color: #333;
                            margin: 0;
                            padding: 20px;
                            -webkit-font-smoothing: antialiased;
                        }
                        
                        .container {
                            max-width: 550px;
                            margin: 0 auto;
                            background: #fff;
                            border-radius: 10px;
                            box-shadow: 0 3px 15px rgba(0, 0, 0, 0.1);
                            overflow: hidden;
                        }
                        
                        .header {
                            background: linear-gradient(to right, #EC9253, #f78839);
                            color: #fff;
                            text-align: center;
                            padding: 30px 20px;
                        }
                        
                        .header h1 {
                            margin: 0;
                            font-size: 24px;
                            font-weight: bold;
                        }
                        
                        .content {
                            padding: 35px 30px;
                            text-align: center;
                        }
                        
                        .content p {
                            margin: 0 0 20px;
                            font-size: 16px;
                            line-height: 1.6;
                            color: #555;
                        }
                        
                        .code-box {
                            margin: 30px auto;
                            width: fit-content;
                            padding: 2px;
                            background: linear-gradient(to right, #EC9253, #f78839);
                            border-radius: 8px;
                        }
                        
                        .code {
                            display: block;
                            padding: 15px 30px;
                            font-size: 28px;
                            font-weight: bold;
                            color: #42130F;
                            background: #ffffff;
                            border-radius: 6px;
                            letter-spacing: 5px;
                        }
                        
                        .warning {
                            margin-top: 30px;
                            padding: 15px;
                            background-color: #fff8f3;
                            border-radius: 8px;
                            font-size: 14px;
                            color: #777;
                            border-left: 3px solid #EC9253;
                        }
                        
                        .footer {
                            text-align: center;
                            padding: 25px 20px;
                            background: #f8f9fa;
                            font-size: 13px;
                            color: #888;
                            border-top: 1px solid #eee;
                        }
                        
                        .footer a {
                            color: #8C20F8;
                            font-weight: bold;
                            text-decoration: none;
                        }
                        
                        .footer a:hover {
                            text-decoration: underline;
                        }
                        
                        .icon {
                            font-size: 40px;
                            margin: 15px 0;
                        }
                        
                        @media only screen and (max-width: 600px) {
                            body {
                                padding: 10px;
                            }
                            
                            .container {
                                width: 100%;
                            }
                            
                            .content {
                                padding: 25px 20px;
                            }
                            
                            .code {
                                font-size: 24px;
                                padding: 12px 20px;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${headerTitle}</h1>
                        </div>
                        
                        <div class="content">
                            <p>${message}</p>
                            
                            <div class="icon">🔑</div>
                            
                            <div class="code-box">
                                <div class="code">${code}</div>
                            </div>
                            
                            <div class="warning">
                                <strong>Atenção:</strong> Caso você não tenha solicitado esta ação, ignore este e-mail ou entre em contato com nosso suporte.
                            </div>
                        </div>
                        
                        <div class="footer">
                            <p>© 2024 <a href="https://www.blinkweb.com.br/" target="_blank">BlinkWeb</a>. Todos os direitos reservados.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendActivationEmail(email: string, activationCode: string): Promise<void> {
    await this.sendGenericEmail(email, "Seu código para ativar a conta chegou! 🚗✨", "Seja bem-vindo(a) à Smart Oficina 🚗", "Hey! Que bom ter você com a gente. Para começar a aproveitar nossa plataforma, basta ativar sua conta com o código abaixo:", activationCode);
  }

  async sendActivationMagicLink(email: string, activationToken: string): Promise<void> {
    if (!EMAIL_ENABLED) {
      logger.info({ email, activationToken }, 'Email desabilitado - não enviando link de ativação');
      return;
    }

    const activationUrl = `${NODE_ENV === 'prod' ? 'https://smartoficina.com.br' : 'http://localhost:3000'}/api/garage/activate/${activationToken}`;
    
    const mailOptions = {
      from: `"Smart Oficina" <${emailUser}>`,
      to: email,
      subject: "Ative sua conta Smart Oficina com um clique! 🚗✨",
      html: `
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Seja bem-vindo(a) à Smart Oficina 🚗</title>
                    <style>
                        body {
                            font-family: 'Arial', sans-serif;
                            background-color: #f8f9fa;
                            color: #333;
                            margin: 0;
                            padding: 20px;
                            -webkit-font-smoothing: antialiased;
                        }
                        
                        .container {
                            max-width: 550px;
                            margin: 0 auto;
                            background: #fff;
                            border-radius: 10px;
                            box-shadow: 0 3px 15px rgba(0, 0, 0, 0.1);
                            overflow: hidden;
                        }
                        
                        .header {
                            background: linear-gradient(to right, #EC9253, #f78839);
                            color: #fff;
                            text-align: center;
                            padding: 30px 20px;
                        }
                        
                        .header h1 {
                            margin: 0;
                            font-size: 24px;
                            font-weight: bold;
                        }
                        
                        .content {
                            padding: 35px 30px;
                            text-align: center;
                        }
                        
                        .content p {
                            margin: 0 0 20px;
                            font-size: 16px;
                            line-height: 1.6;
                            color: #555;
                        }
                        
                        .activation-button {
                            display: inline-block;
                            margin: 30px auto;
                            padding: 15px 40px;
                            background: linear-gradient(to right, #EC9253, #f78839);
                            color: white !important;
                            text-decoration: none;
                            border-radius: 8px;
                            font-size: 18px;
                            font-weight: bold;
                            box-shadow: 0 4px 15px rgba(236, 146, 83, 0.3);
                            transition: transform 0.2s ease;
                        }
                        
                        .activation-button:hover {
                            transform: translateY(-2px);
                            box-shadow: 0 6px 20px rgba(236, 146, 83, 0.4);
                            color: white !important;
                        }
                        
                        .alternative-link {
                            margin-top: 25px;
                            padding: 15px;
                            background-color: #f8f9fa;
                            border-radius: 8px;
                            font-size: 14px;
                            color: #666;
                            word-break: break-all;
                        }
                        
                        .warning {
                            margin-top: 30px;
                            padding: 15px;
                            background-color: #fff8f3;
                            border-radius: 8px;
                            font-size: 14px;
                            color: #777;
                            border-left: 3px solid #EC9253;
                        }
                        
                        .footer {
                            text-align: center;
                            padding: 25px 20px;
                            background: #f8f9fa;
                            font-size: 13px;
                            color: #888;
                            border-top: 1px solid #eee;
                        }
                        
                        .footer a {
                            color: #8C20F8;
                            font-weight: bold;
                            text-decoration: none;
                        }
                        
                        .footer a:hover {
                            text-decoration: underline;
                        }
                        
                        .icon {
                            font-size: 40px;
                            margin: 15px 0;
                        }
                        
                        @media only screen and (max-width: 600px) {
                            body {
                                padding: 10px;
                            }
                            
                            .container {
                                width: 100%;
                            }
                            
                            .content {
                                padding: 25px 20px;
                            }
                            
                            .activation-button {
                                font-size: 16px;
                                padding: 12px 30px;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Seja bem-vindo(a) à Smart Oficina 🚗</h1>
                        </div>
                        
                        <div class="content">
                            <div class="icon">🎉</div>
                            
                            <p>Hey! Que bom ter você com a gente!</p>
                            <p>Para começar a aproveitar nossa plataforma, basta clicar no botão abaixo para ativar sua conta:</p>
                            
                            <a href="${activationUrl}" class="activation-button">
                                ✨ Ativar Minha Conta
                            </a>
                            
                            <div class="alternative-link">
                                <strong>Link não funcionou?</strong><br>
                                Copie e cole este link no seu navegador:<br>
                                <a href="${activationUrl}" style="color: #EC9253;">${activationUrl}</a>
                            </div>
                            
                            <div class="warning">
                                <strong>Atenção:</strong> Este link expira em 24 horas. Caso você não tenha solicitado esta ação, ignore este e-mail ou entre em contato com nosso suporte.
                            </div>
                        </div>
                        
                        <div class="footer">
                            <p>© 2024 <a href="https://www.blinkweb.com.br/" target="_blank">BlinkWeb</a>. Todos os direitos reservados.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendPasswordResetEmail(email: string, resetCode: string): Promise<void> {
    await this.sendGenericEmail(email, "Redefinição de senha para sua conta 🔒", "Redefinição de Senha 🔒", "Você solicitou a redefinição de senha para sua conta Smart Oficina. Use o código abaixo para continuar:", resetCode);
  }

  async sendPaymentConfirmationEmail(email: string, subject: string, headerTitle: string, message: string, planInfo: string): Promise<void> {
    if (!EMAIL_ENABLED) {
      logger.info({ email, subject }, 'Email desabilitado - não enviando confirmação de pagamento');
      return;
    }

    const mailOptions = {
      from: `"Smart Oficina" <${emailUser}>`,
      to: email,
      subject: subject,
      html: `
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${headerTitle}</title>
                    <style>
                        body {
                            font-family: 'Arial', sans-serif;
                            background-color: #f8f9fa;
                            color: #333;
                            margin: 0;
                            padding: 20px;
                            -webkit-font-smoothing: antialiased;
                        }
                        
                        .container {
                            max-width: 550px;
                            margin: 0 auto;
                            background: #fff;
                            border-radius: 10px;
                            box-shadow: 0 3px 15px rgba(0, 0, 0, 0.1);
                            overflow: hidden;
                        }
                        
                        .header {
                            background: linear-gradient(to right, #EC9253, #f78839);
                            color: #fff;
                            text-align: center;
                            padding: 30px 20px;
                        }
                        
                        .header h1 {
                            margin: 0;
                            font-size: 24px;
                            font-weight: bold;
                        }
                        
                        .content {
                            padding: 35px 30px;
                            text-align: center;
                        }
                        
                        .content p {
                            margin: 0 0 20px;
                            font-size: 16px;
                            line-height: 1.6;
                            color: #555;
                        }
                        
                        .plan-info {
                            margin: 30px auto;
                            padding: 20px;
                            background: #f8f9fa;
                            border-radius: 8px;
                            font-size: 16px;
                            color: #444;
                            border-left: 3px solid #EC9253;
                            text-align: left;
                        }
                        
                        .warning {
                            margin-top: 30px;
                            padding: 15px;
                            background-color: #fff8f3;
                            border-radius: 8px;
                            font-size: 14px;
                            color: #777;
                            border-left: 3px solid #EC9253;
                        }
                        
                        .footer {
                            text-align: center;
                            padding: 25px 20px;
                            background: #f8f9fa;
                            font-size: 13px;
                            color: #888;
                            border-top: 1px solid #eee;
                        }
                        
                        .footer a {
                            color: #8C20F8;
                            font-weight: bold;
                            text-decoration: none;
                        }
                        
                        .footer a:hover {
                            text-decoration: underline;
                        }
                        
                        .icon {
                            font-size: 40px;
                            margin: 15px 0;
                        }
                        
                        @media only screen and (max-width: 600px) {
                            body {
                                padding: 10px;
                            }
                            
                            .container {
                                width: 100%;
                            }
                            
                            .content {
                                padding: 25px 20px;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${headerTitle}</h1>
                        </div>
                        
                        <div class="content">
                            <p>${message}</p>
                            
                            <div class="plan-info">
                                ${planInfo}
                            </div>
                            
                            <div class="warning">
                                <strong>Dúvidas?</strong> Entre em contato com nosso suporte pelo e-mail suporte@smartoficina.com.br
                            </div>
                        </div>
                        
                        <div class="footer">
                            <p>© 2024 <a href="https://www.blinkweb.com.br/" target="_blank">BlinkWeb</a>. Todos os direitos reservados.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendNewSubscriptionEmail(email: string, planName: string, endDate: Date, isFree: boolean = false): Promise<void> {
    if (!EMAIL_ENABLED) {
      logger.info({ email, planName, isFree }, 'Email desabilitado - não enviando email de nova assinatura');
      return;
    }

    const formattedDate = endDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const subject = "Confirmação de Assinatura Smart Oficina ✅";
    const headerTitle = "Assinatura Confirmada! 🎉";

    const message = isFree ? "Uhuul! 🚀 Sua assinatura gratuita está ativa! Obrigado por escolher a Smart Oficina. Estamos super animados para ajudar seu negócio a crescer!" : "Uhuul! 🚀 Pagamento confirmado e assinatura ativa! Obrigado pela confiança. Estamos super felizes em ajudar sua oficina a alcançar resultados incríveis!";

    const planInfo = `
            <strong>Plano:</strong> ${planName}<br>
            <strong>Validade:</strong> até ${formattedDate}<br>
            <strong>Status:</strong> Ativo
        `;

    await this.sendPaymentConfirmationEmail(email, subject, headerTitle, message, planInfo);
  }

  async sendRenewalEmail(email: string, planName: string, endDate: Date, isFree: boolean = false): Promise<void> {
    if (!EMAIL_ENABLED) {
      logger.info({ email, planName, isFree }, 'Email desabilitado - não enviando email de renovação');
      return;
    }

    const formattedDate = endDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const subject = "Sua assinatura Smart Oficina foi renovada! ✅";
    const headerTitle = "Renovação Confirmada! 🔄";

    const message = isFree ? "Show de bola! 🎯 Assinatura renovada com seu cupom gratuito! Sua confiança nos motiva a sempre oferecer as melhores soluções para sua oficina!" : "Show de bola! 🎯 Assinatura renovada com sucesso! Obrigado por continuar conosco. É um prazer ajudar a impulsionar sua oficina!";

    const planInfo = `
            <strong>Plano:</strong> ${planName}<br>
            <strong>Nova validade:</strong> até ${formattedDate}<br>
            <strong>Status:</strong> Ativo
        `;

    await this.sendPaymentConfirmationEmail(email, subject, headerTitle, message, planInfo);
  }

  async sendUpgradeEmail(email: string, oldPlanName: string, newPlanName: string, endDate: Date, isFree: boolean = false): Promise<void> {
    if (!EMAIL_ENABLED) {
      logger.info({ email, oldPlanName, newPlanName, isFree }, 'Email desabilitado - não enviando email de upgrade');
      return;
    }

    const formattedDate = endDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const subject = "Upgrade de Plano Smart Oficina Confirmado! ⬆️";
    const headerTitle = "Upgrade Realizado com Sucesso! 🚀";

    const message = isFree ? "Demais! 🔥 Upgrade concluído sem custos adicionais! Parabéns pela evolução! Agora você tem mais recursos para impulsionar sua oficina!" : "Demais! 🔥 Upgrade concluído com sucesso! Obrigado por investir no crescimento da sua oficina. Estamos animados para ver você aproveitar todos os novos recursos!";

    const planInfo = `
            <strong>Plano anterior:</strong> ${oldPlanName}<br>
            <strong>Novo plano:</strong> ${newPlanName}<br>
            <strong>Validade:</strong> até ${formattedDate}<br>
            <strong>Status:</strong> Ativo
        `;

    await this.sendPaymentConfirmationEmail(email, subject, headerTitle, message, planInfo);
  }
}

export const emailService = new EmailService();
