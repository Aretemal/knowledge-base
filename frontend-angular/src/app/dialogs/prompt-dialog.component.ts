import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';

export interface PromptDialogData {
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
}

@Component({
  selector: 'app-prompt-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, FormsModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <div mat-dialog-content>
      <p *ngIf="data.message">{{ data.message }}</p>
      <input
        matInput
        type="text"
        [(ngModel)]="value"
        [placeholder]="data.placeholder ?? ''"
        style="width: 100%; margin-top: 8px"
      />
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Отмена</button>
      <button mat-flat-button color="primary" (click)="onConfirm()">
        {{ data.confirmText ?? 'ОК' }}
      </button>
    </div>
  `,
})
export class PromptDialogComponent {
  value: string;

  constructor(
    private dialogRef: MatDialogRef<PromptDialogComponent, string | null>,
    @Inject(MAT_DIALOG_DATA) public data: PromptDialogData,
  ) {
    this.value = data.initialValue ?? '';
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onConfirm(): void {
    const trimmed = this.value.trim();
    this.dialogRef.close(trimmed || null);
  }
}

