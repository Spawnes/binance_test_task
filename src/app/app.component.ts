import { Component } from '@angular/core';
import {BinanceToolsListComponent} from './binance-tools-list/binance-tools-list.component';

@Component({
  selector: 'app-root',
  imports: [BinanceToolsListComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {

}
