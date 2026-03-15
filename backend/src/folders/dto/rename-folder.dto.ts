import { IsString, MaxLength } from 'class-validator';

export class RenameFolderDto {
  @IsString()
  @MaxLength(500)
  name: string;
}
