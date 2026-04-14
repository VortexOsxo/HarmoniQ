import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmationModal } from '../confirmation-modal/confirmation-modal';

@Component({
  selector: 'app-delete-confirm-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './delete-confirm-button.html',
  styleUrl: './delete-confirm-button.css'
})
export class DeleteConfirmButtonComponent {
  @Input() buttonTitle: string = 'Supprimer';
  @Input() confirmTitle: string = 'Confirmation de suppression';
  @Input() confirmMessage: string = 'Êtes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible.';
  @Input() confirmText: string = 'Supprimer';
  @Input() disabled: boolean = false;

  @Output() delete = new EventEmitter<void>();

  constructor(private modalService: NgbModal) {}

  onButtonClick(event: Event) {
    event.stopPropagation();
    if (this.disabled) return;

    const modalRef = this.modalService.open(ConfirmationModal, { centered: true });
    modalRef.componentInstance.title = this.confirmTitle;
    modalRef.componentInstance.message = this.confirmMessage;
    modalRef.componentInstance.confirmText = this.confirmText;

    modalRef.result.then((confirmed) => {
      if (confirmed) {
        this.delete.emit();
      }
    }).catch(() => {
      // Modal dismissed, do nothing
    });
  }
}
