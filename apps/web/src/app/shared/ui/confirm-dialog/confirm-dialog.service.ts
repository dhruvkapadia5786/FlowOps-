import { Dialog } from '@angular/cdk/dialog';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly dialog = inject(Dialog);

  open(data: ConfirmDialogData): Observable<boolean> {
    const ref = this.dialog.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      data,
      backdropClass: 'fo-dialog-backdrop',
      panelClass: 'fo-dialog-panel',
    });
    return ref.closed.pipe(map((value) => value === true));
  }
}
