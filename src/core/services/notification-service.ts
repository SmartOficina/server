import axios from 'axios';
import logger from '../../logger';

class NotificationService {
  private readonly topic: string = 'garage-notifications-smartoficina';
  private readonly baseUrl: string = 'https://ntfy.sh';

  constructor() {
    logger.info(`Sistema de notificações inicializado com tópico: ${this.topic}`);
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

  public async sendAccountCreatedNotification(garageName: string, userEmail: string): Promise<boolean> {
    const title = 'Nova Oficina Cadastrada';
    const message = `🏪 ${garageName}\n📧 ${userEmail}\n📅 ${new Date().toLocaleString('pt-BR')}`;
    
    return await this.sendNotification(title, message, 'high');
  }

  public async sendSubscriptionNotification(garageName: string, planName: string, action: 'nova' | 'renovacao', amount: number): Promise<boolean> {
    const title = action === 'nova' ? 'Pagamento Confirmado' : 'Renovacao Confirmada';
    const emoji = action === 'nova' ? '💰' : '🔄';
    const message = `${emoji} ${garageName}\n📋 ${planName}\n💲 R$ ${amount.toFixed(2)}\n📅 ${new Date().toLocaleString('pt-BR')}`;
    
    return await this.sendNotification(title, message, 'high');
  }

}

export const notificationService = new NotificationService();