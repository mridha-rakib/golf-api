import { AUTH } from "@/constants/app.constants";
import { generateRandomPassword } from "@/utils/password.utils";

export class PasswordGeneratorService {
  private readonly length: number;

  constructor(length: number = 12) {
    this.length = Math.max(length, AUTH.MIN_PASSWORD_LENGTH);
  }

  generate(): string {
    return generateRandomPassword(this.length);
  }
}
