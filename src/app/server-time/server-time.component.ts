import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, interval, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { AsyncPipe } from '@angular/common';

interface ServerTimeResponse {
  serverTime: number;
}

@Component({
  selector: 'app-server-time',
  standalone: true,
  imports: [CommonModule, AsyncPipe],
  templateUrl: './server-time.component.html',
  styleUrls: ['./server-time.component.scss'],
})
export class ServerTimeComponent implements OnInit {
  serverTime$: Observable<number> | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.serverTime$ = interval(1000).pipe( // Обновляем каждую секунду
      switchMap(() => this.http.get<ServerTimeResponse>('https://api.binance.com/api/v3/time')),
      map((data) => data.serverTime)
    );
  }

  getExchangeTime(): string {
    const now = new Date();
    return now.toLocaleTimeString();
  }

  showTooltip(tooltip: HTMLElement) {
    setTimeout(() => {
      tooltip.style.display = 'block';
    }, 200);
  }

  hideTooltip(tooltip: HTMLElement) {
    setTimeout(() => {
      tooltip.style.display = 'none';
    }, 200);
  }
}
