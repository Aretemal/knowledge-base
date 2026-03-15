import { IsString, MaxLength } from 'class-validator';

export class RenameFileDto {
  @IsString()
  @MaxLength(500)
  name: string;
}
