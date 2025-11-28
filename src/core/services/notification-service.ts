import axios from 'axios';
import logger from '../../logger';

class NotificationService {
  private readonly topic: string = 'garage-notifications-smartoficina';
  private readonly baseUrl: string = 'https://ntfy.sh';
  private readonly discordBotUrl: string = process.env.DISCORD_BOT_URL || 'http://garage-discord-bot:3001';
  private readonly webhookSecret: string = process.env.WEBHOOK_SECRET || 'change_this_secret';

  constructor() {
    logger.info(`Sistema de notificações inicializado com tópico: ${this.topic}`);
    logger.info(`Discord Bot URL: ${this.discordBotUrl}`);
  }


  public async sendNotification(title: string, message: string, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/${this.topic}`;
      
      logger.info('Enviando notificação:', {
        url,
        title,
        message: message.substring(0, 50) + '...',
        priority
      });

      const response = await axios.post(url, message, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Title': title,
          'X-Priority': priority === 'high' ? '4' : priority === 'low' ? '2' : '3',
          'X-Tags': 'garage,smartoficina'
        },
        timeout: 10000
      });

      if (response.status === 200) {
        logger.info(`Notificação enviada com sucesso: ${title}`);
        return true;
      } else {
        logger.error(`Erro ao enviar notificação. Status: ${response.status}`);
        return false;
      }
    } catch (error: any) {
      logger.error(`Erro ao enviar notificação: ${error.message}`);
      if (error.response) {
        logger.error(`Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
      }
      return false;
    }
  }

  private async sendToDiscord(eventType: string, data: any): Promise<boolean> {
    try {
      const event = {
        type: eventType,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        data
      };

      const response = await axios.post(`${this.discordBotUrl}/webhook`, event, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': this.webhookSecret
        },
        timeout: 5000
      });

      if (response.status === 200) {
        logger.info(`Discord log enviado com sucesso: ${eventType}`);
        return true;
      } else {
        logger.error(`Erro ao enviar para Discord. Status: ${response.status}`);
        return false;
      }
    } catch (error: any) {
      logger.error(`Erro ao enviar para Discord: ${error.message}`);
      return false;
    }
  }

  public async sendAccountCreatedNotification(garageName: string, userEmail: string, garageId: string, phone?: string, cnpjCpf?: string, location?: string): Promise<boolean> {
    const title = 'Nova Oficina Cadastrada';
    const message = `🏪 ${garageName}\n📧 ${userEmail}\n📅 ${new Date().toLocaleString('pt-BR')}`;

    const ntfyResult = await this.sendNotification(title, message, 'high');

    const discordResult = await this.sendToDiscord('user_created', {
      garageName,
      email: userEmail,
      phone: phone || 'Não informado',
      cnpjCpf: cnpjCpf || 'Não informado',
      location,
      garageId
    });

    return ntfyResult || discordResult;
  }

  public async sendUserActivatedNotification(garageName: string, userEmail: string, garageId: string): Promise<boolean> {
    return await this.sendToDiscord('user_activated', {
      garageName,
      email: userEmail,
      garageId
    });
  }

  public async sendSubscriptionNotification(garageName: string, planName: string, action: 'nova' | 'renovacao' | 'upgrade', amount: number, interval?: string, startDate?: Date, endDate?: Date, paymentMethod?: string, previousPlan?: string): Promise<boolean> {
    const title = action === 'nova' ? 'Pagamento Confirmado' : action === 'renovacao' ? 'Renovacao Confirmada' : 'Upgrade de Plano';
    const emoji = action === 'nova' ? '💰' : action === 'renovacao' ? '🔄' : '⬆️';
    const message = `${emoji} ${garageName}\n📋 ${planName}\n💲 R$ ${amount.toFixed(2)}\n📅 ${new Date().toLocaleString('pt-BR')}`;

    const ntfyResult = await this.sendNotification(title, message, 'high');

    let eventType = 'subscription_new';
    if (action === 'renovacao') eventType = 'subscription_renewed';
    if (action === 'upgrade') eventType = 'subscription_upgraded';

    const discordResult = await this.sendToDiscord(eventType, {
      garageName,
      planName,
      amount,
      interval: interval || 'monthly',
      startDate: startDate?.toISOString() || new Date().toISOString(),
      endDate: endDate?.toISOString() || new Date().toISOString(),
      paymentMethod: paymentMethod || 'Não especificado',
      previousPlan
    });

    return ntfyResult || discordResult;
  }

  public async sendBackupNotification(backupType: 'daily' | 'weekly' | 'manual', status: 'success' | 'failed', fileName?: string, fileSize?: string, duration?: string, error?: string): Promise<boolean> {
    const eventType = status === 'success' ? 'backup_created' : 'backup_failed';

    return await this.sendToDiscord(eventType, {
      backupType,
      fileName,
      fileSize,
      duration,
      status,
      error
    });
  }

  public async sendDeployNotification(deployType: 'started' | 'completed' | 'failed', branch: string, commit: string, author: string, version: string, duration?: string, error?: string): Promise<boolean> {
    let eventType = 'deploy_started';
    if (deployType === 'completed') eventType = 'deploy_completed';
    if (deployType === 'failed') eventType = 'deploy_failed';

    return await this.sendToDiscord(eventType, {
      branch,
      commit,
      author,
      version,
      duration,
      status: deployType === 'completed' ? 'success' : deployType === 'failed' ? 'failed' : undefined,
      error
    });
  }

  public async sendErrorNotification(errorType: string, message: string, stack?: string, endpoint?: string, garageId?: string, garageName?: string): Promise<boolean> {
    return await this.sendToDiscord('error_critical', {
      errorType,
      message,
      stack,
      endpoint,
      garageId,
      garageName
    });
  }

}

export const notificationService = new NotificationService();