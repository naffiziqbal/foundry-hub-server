import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CommentVisibility } from '../../common/enums';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @IsOptional()
  @IsEnum(CommentVisibility)
  visibility?: CommentVisibility;
}
