import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import {
  HttpExceptionFilter,
  AllExceptionsFilter,
} from './common/filters/http-exception.filter';
import { config } from 'dotenv';
import { resolve } from 'path';

async function bootstrap() {
  // 设置全局时区为东八区（Asia/Shanghai）
  process.env.TZ = 'Asia/Shanghai';
  config({
    path: resolve(process.cwd(), '.env'),
  });
  const logger = new Logger('Bootstrap');
  const port = process.env.PORT ?? 8888;

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false, // 禁用隐式转换
      },
      skipMissingProperties: true, // 跳过缺失属性，配合 @IsOptional() 使用
    }),
  );

  // 全局响应拦截器 - 统一成功响应格式
  app.useGlobalInterceptors(new TransformInterceptor());

  // 全局异常过滤器 - 统一错误响应格式
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  await app.listen(port);
  logger.log(`🚀 服务器已启动，监听端口: ${port}`);
  logger.log(`📝 环境: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`⏰ 时区: ${process.env.TZ || 'Asia/Shanghai'}`);
}
bootstrap()
  .then(() => {
    // 启动成功日志已在 bootstrap 中输出
  })
  .catch((error) => {
    const logger = new Logger('Bootstrap');
    logger.error('❌ 服务器启动失败:', error);
    process.exit(1);
  });
