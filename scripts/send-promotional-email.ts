import dotenv from "dotenv";
import nodemailer from "nodemailer";
import logger from "../src/logger";
import fs from "fs/promises";
import path from "path";

dotenv.config();

const marketingEmailUser = process.env.MARKETING_EMAIL_USER;
const marketingEmailPassword = process.env.MARKETING_EMAIL_PASSWORD;
const marketingEmailFrom = process.env.MARKETING_EMAIL_FROM || 'noreply@smartoficina.com.br';
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';

const BATCH_SIZE = parseInt(process.env.EMAIL_BATCH_SIZE || '5');
const DELAY_BETWEEN_BATCHES = parseInt(process.env.EMAIL_BATCH_DELAY || '2000');
const DELAY_BETWEEN_EMAILS = parseInt(process.env.EMAIL_DELAY || '500');
const MAX_RETRIES = parseInt(process.env.EMAIL_MAX_RETRIES || '3');

interface EmailStats {
  total: number;
  sent: number;
  failed: number;
  invalid: number;
  startTime: Date;
}

class PromotionalEmailService {
  private transporter: any;
  private stats: EmailStats;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: "smtp.zeptomail.com",
      port: 587,
      secure: false,
      auth: {
        user: marketingEmailUser,
        pass: marketingEmailPassword,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
    
    this.stats = {
      total: 0,
      sent: 0,
      failed: 0,
      invalid: 0,
      startTime: new Date()
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async sendSingleEmail(email: string, subject: string, htmlContent: string, retries: number = 0): Promise<boolean> {
    const mailOptions = {
      from: `"Smart Oficina" <${marketingEmailFrom}>`,
      to: email.trim(),
      subject: subject,
      html: htmlContent,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info(`Email enviado com sucesso para: ${email}`);
      this.stats.sent++;
      return true;
    } catch (error) {
      if (retries < MAX_RETRIES) {
        logger.warn(`Erro ao enviar email para ${email}, tentativa ${retries + 1}/${MAX_RETRIES}:`, error);
        await this.sleep(1000 * (retries + 1));
        return this.sendSingleEmail(email, subject, htmlContent, retries + 1);
      } else {
        logger.error(`Falha definitiva ao enviar email para ${email} após ${MAX_RETRIES} tentativas:`, error);
        this.stats.failed++;
        return false;
      }
    }
  }

  private logProgress(): void {
    const elapsed = Date.now() - this.stats.startTime.getTime();
    const processed = this.stats.sent + this.stats.failed;
    const remaining = this.stats.total - processed;
    const rate = processed / (elapsed / 1000 / 60);
    const estimatedTimeLeft = remaining / rate;

    logger.info(`Progresso: ${processed}/${this.stats.total} (${((processed / this.stats.total) * 100).toFixed(1)}%) | ` +
                `Enviados: ${this.stats.sent} | Falhas: ${this.stats.failed} | Inválidos: ${this.stats.invalid} | ` +
                `Taxa: ${rate.toFixed(1)} emails/min | Tempo restante: ${estimatedTimeLeft.toFixed(1)} min`);
  }

  async loadEmailsFromFile(filePath: string): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const emails = content
        .split('\n')
        .map(email => email.trim())
        .filter(email => email.length > 0);
      
      logger.info(`Carregados ${emails.length} emails do arquivo ${filePath}`);
      return emails;
    } catch (error) {
      logger.error(`Erro ao ler arquivo ${filePath}:`, error);
      throw error;
    }
  }

  async sendPromotionalEmailBatch(emails: string[]): Promise<void> {
    if (!EMAIL_ENABLED) {
      logger.info({ count: emails.length }, 'Email desabilitado - não enviando emails promocionais');
      return;
    }

    const subject = "🎁 Convite exclusivo: experimente a Smart Oficina sem pagar nada!!";
    const headerTitle = "Oferta Especial Smart Oficina! 🎁";

    const validEmails = emails.filter(email => {
      const isValid = this.isValidEmail(email);
      if (!isValid) {
        logger.warn(`Email inválido ignorado: ${email}`);
        this.stats.invalid++;
      }
      return isValid;
    });

    this.stats.total = validEmails.length;
    logger.info(`Iniciando envio de ${validEmails.length} emails em lotes de ${BATCH_SIZE}...`);
    logger.info(`Configurações: Delay entre emails: ${DELAY_BETWEEN_EMAILS}ms, Delay entre lotes: ${DELAY_BETWEEN_BATCHES}ms`);

    const htmlContent = `
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
                  max-width: 600px;
                  margin: 0 auto;
                  background: #fff;
                  border-radius: 12px;
                  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
                  overflow: hidden;
              }
              
              .header {
                  background: linear-gradient(135deg, #EC9253, #f78839);
                  color: #fff;
                  text-align: center;
                  padding: 35px 20px;
                  position: relative;
                  overflow: hidden;
              }
              
              .header::before {
                  content: '';
                  position: absolute;
                  top: -50%;
                  right: -50%;
                  width: 200%;
                  height: 200%;
                  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
              }
              
              .header h1 {
                  margin: 0;
                  font-size: 26px;
                  font-weight: bold;
                  position: relative;
                  z-index: 1;
              }
              
              .content {
                  padding: 40px 35px;
                  text-align: center;
              }
              
              .content p {
                  margin: 0 0 20px;
                  font-size: 17px;
                  line-height: 1.7;
                  color: #444;
              }
              
              .highlight-text {
                  font-size: 20px;
                  font-weight: bold;
                  color: #EC9253;
                  margin: 25px 0;
              }
              
              
              .cta-section {
                  margin: 35px 0;
                  padding: 30px;
                  background: linear-gradient(135deg, #fff8f3, #fef7f0);
                  border-radius: 12px;
                  border: 2px solid #f0ddd1;
              }
              
              .cta-button {
                  display: inline-block;
                  margin: 20px auto;
                  padding: 18px 45px;
                  background: linear-gradient(135deg, #EC9253, #f78839);
                  color: white !important;
                  text-decoration: none;
                  border-radius: 30px;
                  font-size: 18px;
                  font-weight: bold;
                  box-shadow: 0 6px 20px rgba(236, 146, 83, 0.4);
                  transition: all 0.3s ease;
                  text-transform: uppercase;
                  letter-spacing: 1px;
              }
              
              .cta-button:hover {
                  transform: translateY(-3px);
                  box-shadow: 0 8px 25px rgba(236, 146, 83, 0.5);
                  color: white !important;
              }
              
              .urgency-text {
                  background: linear-gradient(135deg, #ff6b6b, #ff5252);
                  color: white;
                  padding: 15px 20px;
                  border-radius: 8px;
                  margin: 25px 0;
                  font-weight: bold;
                  font-size: 16px;
              }
              
              .benefits {
                  display: flex;
                  justify-content: space-around;
                  margin: 30px 0;
                  flex-wrap: wrap;
              }
              
              .benefit-item {
                  text-align: center;
                  margin: 15px;
                  flex: 1;
                  min-width: 120px;
              }
              
              .benefit-icon {
                  font-size: 35px;
                  margin-bottom: 10px;
              }
              
              .benefit-text {
                  font-size: 14px;
                  color: #666;
                  font-weight: bold;
              }
              
              .footer {
                  text-align: center;
                  padding: 30px 20px;
                  background: #f8f9fa;
                  font-size: 13px;
                  color: #888;
                  border-top: 1px solid #eee;
              }
              
              .footer a {
                  color: #EC9253;
                  font-weight: bold;
                  text-decoration: none;
              }
              
              .footer a:hover {
                  text-decoration: underline;
              }
              
              @media only screen and (max-width: 600px) {
                  body {
                      padding: 10px;
                  }
                  
                  .container {
                      width: 100%;
                  }
                  
                  .content {
                      padding: 30px 25px;
                  }
                  
                  .cta-button {
                      font-size: 16px;
                      padding: 15px 35px;
                  }
                  
                  .benefits {
                      flex-direction: column;
                  }
                  
                  .header h1 {
                      font-size: 22px;
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
                  <p><strong>Chega de perder tempo com papelada e controles manuais.</strong></p>
                  <p>Com a Smart Oficina, <strong>sua oficina ganha uma solução completa</strong> para organizar clientes, veículos, ordens de serviço e estoque em um só lugar.</p>
                  
                  
                  <div class="benefits">
                      <div class="benefit-item">
                          <div class="benefit-icon">👉</div>
                          <div class="benefit-text">1 Mês Grátis</div>
                      </div>
                      <div class="benefit-item">
                          <div class="benefit-icon">⚡</div>
                          <div class="benefit-text">Oferta Limitada</div>
                      </div>
                      <div class="benefit-item">
                          <div class="benefit-icon">🚀</div>
                          <div class="benefit-text">Sem Compromisso</div>
                      </div>
                  </div>
                  
                  <div class="highlight-text">
                      👉 Ative agora seu cupom e ganhe 1 mês grátis no plano básico!
                  </div>
                  
                  <div class="urgency-text">
                      ⚡ Oferta disponível apenas para as primeiras oficinas que resgatarem.
                  </div>
                  
                  <div class="cta-section">
                      <a href="http://smartoficina.com.br/register?coupon=SMART100" class="cta-button">
                          Garantir meu teste grátis
                      </a>
                      
                      <div class="alternative-link">
                          <strong>Botão não funcionou?</strong><br>
                          Copie e cole este link no seu navegador:<br>
                          <a href="http://smartoficina.com.br/register?coupon=SMART100" style="color: #EC9253;">http://smartoficina.com.br/register?coupon=SMART100</a>
                      </div>
                  </div>
              </div>
              
              <div class="footer">
                  <p>© 2024 <a href="https://www.blinkweb.com.br/" target="_blank">BlinkWeb</a>. Todos os direitos reservados.</p>
                  <p>Smart Oficina - A solução completa para sua oficina.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    for (let i = 0; i < validEmails.length; i += BATCH_SIZE) {
      const batch = validEmails.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(validEmails.length / BATCH_SIZE);
      
      logger.info(`Processando lote ${batchNumber}/${totalBatches} (${batch.length} emails)`);
      
      const promises = batch.map(async (email, index) => {
        if (index > 0) {
          await this.sleep(DELAY_BETWEEN_EMAILS);
        }
        return this.sendSingleEmail(email, subject, htmlContent);
      });
      
      await Promise.all(promises);
      
      this.logProgress();
      
      if (i + BATCH_SIZE < validEmails.length) {
        logger.info(`Aguardando ${DELAY_BETWEEN_BATCHES}ms antes do próximo lote...`);
        await this.sleep(DELAY_BETWEEN_BATCHES);
      }
    }

    const duration = (Date.now() - this.stats.startTime.getTime()) / 1000 / 60;
    logger.info(`Envio concluído! Duração: ${duration.toFixed(2)} minutos`);
    logger.info(`Estatísticas finais: ${this.stats.sent} enviados, ${this.stats.failed} falhas, ${this.stats.invalid} inválidos`);
  }
}

async function main() {
  const promotionalService = new PromotionalEmailService();
  
  try {
    const leadsFilePath = path.join(__dirname, 'leads.txt');
    logger.info('Iniciando sistema de envio de emails promocionais otimizado...');
    
    const emails = await promotionalService.loadEmailsFromFile(leadsFilePath);
    
    if (emails.length === 0) {
      logger.warn('Nenhum email encontrado no arquivo leads.txt');
      return;
    }
    
    await promotionalService.sendPromotionalEmailBatch(emails);
    logger.info('Processo de envio de emails concluído!');
  } catch (error) {
    logger.error('Erro ao enviar emails promocionais:', error);
    process.exit(1);
  }
}

main();