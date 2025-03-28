import {Component, Output, EventEmitter, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent {
  @Input() searchTerm = '';
  @Output() searchTermChange = new EventEmitter<string>();

  onSearchTermChange() {
    this.searchTermChange.emit(this.searchTerm);
  }
}
