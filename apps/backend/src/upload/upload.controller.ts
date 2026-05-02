import { randomUUID } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import { extname, join, basename } from 'path';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

const UPLOAD_ROOT = join(process.cwd(), 'uploads');
const URL_PREFIX = '/api/uploads/';

const allowedExt = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

@Controller('upload')
export class UploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_ROOT,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!allowedExt.has(ext)) {
          return cb(new BadRequestException('仅支持 png/jpg/jpeg/gif/webp 格式'), false);
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('未接收到文件');
    }
    return { url: `${URL_PREFIX}${file.filename}` };
  }

  @Delete()
  remove(@Body() body: { url: string }) {
    const url = body?.url || '';
    if (!url.startsWith(URL_PREFIX)) {
      // 静默忽略：非本服务上传的 URL 一律不处理（防越权删除）
      return { ok: true };
    }
    const filename = basename(url);
    // basename 已经规避了 ../ 跳目录，但再保一道
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      return { ok: true };
    }
    const filepath = join(UPLOAD_ROOT, filename);
    if (existsSync(filepath)) {
      try {
        unlinkSync(filepath);
      } catch {
        // 删不掉就当作已经没了，前端不展示错误
      }
    }
    return { ok: true };
  }
}
