import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { StorageService } from './storage.service';

const ALLOWED = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'application/pdf',
];

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  /**
   * Generic upload endpoint. Sends the file straight to DigitalOcean Spaces
   * and returns the CDN URL the client should persist on the entity.
   */
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder = 'uploads',
  ) {
    if (!file) throw new BadRequestException('No file provided (field "file").');
    if (!ALLOWED.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    const safeFolder = ['products', 'attachments', 'avatars', 'exports'].includes(
      folder,
    )
      ? folder
      : 'uploads';

    const { url, key } = await this.storage.upload(file.buffer, {
      folder: safeFolder,
      filename: file.originalname,
      contentType: file.mimetype,
    });
    return { url, key };
  }
}
