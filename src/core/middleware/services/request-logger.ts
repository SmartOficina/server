import { Request, Response, NextFunction } from 'express';
import chalk from 'chalk';
import logger from '../../../logger';

const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime();

    res.on('finish', () => {
        const elapsedTime = process.hrtime(start);
        const elapsedMilliseconds = elapsedTime[0] * 1000 + elapsedTime[1] / 1e6;

        const statusCode = res.statusCode;
        let statusColor: string;

        if (statusCode >= 500) {
            statusColor = chalk.red(statusCode.toString());
        } else if (statusCode >= 400) {
            statusColor = chalk.yellow(statusCode.toString());
        } else if (statusCode >= 300) {
            statusColor = chalk.cyan(statusCode.toString());
        } else if (statusCode >= 200) {
            statusColor = chalk.green(statusCode.toString());
        } else {
            statusColor = chalk.white(statusCode.toString());
        }

        logger.info(`${req.method} ${req.originalUrl} ${statusColor} ${elapsedMilliseconds.toFixed(3)} ms`);
    });

    next();
};

export default requestLogger;