import {Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit} from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {CommonModule} from '@angular/common';
import {ServerTimeComponent} from '../server-time/server-time.component';
import {SearchComponent} from '../search/search.component';
import {FormsModule} from '@angular/forms';
import {catchError, of, Subscription, Observable} from 'rxjs';
import {webSocket, WebSocketSubject} from 'rxjs/webSocket';

// Интерфейс для данных обмена Binance
interface BinanceExchangeInfo {
  symbols: {
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
  }[];
}

// Интерфейс для данных тикера 24 часа Binance
interface BinanceTicker24hr {
  symbol: string;
  priceChangePercent: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
}

@Component({
  selector: 'app-binance-tools-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ServerTimeComponent, SearchComponent],
  templateUrl: './binance-tools-list.component.html',
  styleUrls: ['./binance-tools-list.component.scss']
})
export class BinanceToolsListComponent implements OnInit, OnDestroy, AfterViewInit {
  // Массив всех инструментов Binance
  tools: BinanceExchangeInfo['symbols'] = [];
  // Массив отображаемых инструментов (для пагинации и фильтрации)
  displayedTools: BinanceExchangeInfo['symbols'] = [];
  // Объект для хранения данных тикера по символу
  tickerData: { [key: string]: BinanceTicker24hr } = {};
  // Максимальное количество инструментов для загрузки
  maxTools = 1000;
  // Время сервера Binance
  serverTime: number = 0;
  // Размер пакета для пагинации
  private batchSize = 50;
  // Текущий индекс для загрузки следующего пакета
  private currentIndex = 0;
  // Флаг загрузки данных
  loading = true;
  // Строка поиска для фильтрации инструментов
  searchTerm = '';
  // Направление сортировки (asc или desc)
  sortDirection: 'asc' | 'desc' = 'asc';

  // Ссылка на контейнер таблицы для обработки событий прокрутки
  @ViewChild('tableContainer') tableContainer!: ElementRef;

  // WebSocket объект для получения данных в реальном времени
  private socket$!: WebSocketSubject<any>;
  // Подписка на WebSocket
  private websocketSubscription!: Subscription;

  constructor(private http: HttpClient) {
  }

  // Инициализация компонента
  ngOnInit() {
    this.fetchExchangeInfo(); // Получение информации об обмене
    this.fetchTickerData(); // Получение данных тикера
    this.fetchServerTime(); // Получение времени сервера
    this.connectToWebsocket(); // Подключение к WebSocket
  }

  // Вызывается после инициализации представления компонента
  ngAfterViewInit() {
    this.tableContainer.nativeElement.addEventListener('scroll', this.onScroll.bind(this));
  }

  // Вызывается при уничтожении компонента
  ngOnDestroy() {
    this.tableContainer.nativeElement.removeEventListener('scroll', this.onScroll.bind(this));
    this.disconnectFromWebsocket(); // Отключение от WebSocket
  }

  // Получение информации об обмене Binance
  private fetchExchangeInfo() {
    this.http.get<BinanceExchangeInfo>('https://api.binance.com/api/v3/exchangeInfo').pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error fetching exchange info:', error);
        this.loading = false;
        return of({symbols: []});
      })
    ).subscribe(data => {
      this.tools = data.symbols.slice(0, this.maxTools); // Ограничение количества инструментов
      this.loadInitialTools(); // Загрузка начального пакета инструментов
      setTimeout(() => {
        this.loading = false;
      }, 1000); // Задержка для отображения загрузки
    });
  }

  // Получение данных тикера 24 часа Binance
  private fetchTickerData() {
    this.http.get<BinanceTicker24hr[]>('https://api.binance.com/api/v3/ticker/24hr').pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error fetching ticker data:', error);
        return of([]);
      })
    ).subscribe(data => {
      data.forEach(item => {
        this.tickerData[item.symbol] = item; // Сохранение данных тикера по символу
      });
    });
  }

  // Получение времени сервера Binance
  private fetchServerTime(): Observable<{ serverTime: number }> {
    return this.http.get<{ serverTime: number }>('https://api.binance.com/api/v3/time').pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error fetching server time:', error);
        return of({serverTime: 0});
      })
    );
  }

  // Форматирование объема для отображения
  formatVolume(volume: string | undefined): string {
    if (volume === undefined) {
      return 'N/A';
    }
    const volumeNum = parseFloat(volume);
    if (volumeNum >= 1000000) {
      return (volumeNum / 1000000).toFixed(2) + 'M'; // Миллионы
    } else if (volumeNum >= 1000) {
      return (volumeNum / 1000).toFixed(2) + 'K'; // Тысячи
    } else {
      return volumeNum.toFixed(2);
    }
  }

  // Загрузка начального пакета инструментов
  loadInitialTools() {
    this.displayedTools = this.tools.slice(0, this.batchSize);
    this.currentIndex = this.batchSize;
  }

  // Обработчик события прокрутки
  onScroll(event: any) {
    if (event.target.scrollHeight - event.target.scrollTop - event.target.clientHeight < 100) {
      this.loadMoreTools(); // Загрузка следующего пакета инструментов
    }
  }

  // Загрузка следующего пакета инструментов
  loadMoreTools() {
    const nextBatch = this.tools.slice(this.currentIndex, this.currentIndex + this.batchSize);
    this.displayedTools = this.displayedTools.concat(nextBatch);
    this.currentIndex += this.batchSize;
  }

  // Фильтрация инструментов по строке поиска
  filterTools(searchTerm: string) {
    this.searchTerm = searchTerm;
    if (!this.searchTerm) {
      this.displayedTools = this.tools.slice(0, this.currentIndex);
    } else {
      const searchTermLower = this.searchTerm.toLowerCase();
      this.displayedTools = this.tools.filter(tool => this.filterTool(tool, searchTermLower));
    }
  }

  // Проверка, соответствует ли инструмент строке поиска
  private filterTool(tool: any, searchTermLower: string): boolean {
    const symbol = tool.symbol.toLowerCase();
    const baseAsset = tool.baseAsset.toLowerCase();
    const quoteAsset = tool.quoteAsset.toLowerCase();

    const ticker = this.tickerData[tool.symbol];
    if (!ticker) {
      return symbol.includes(searchTermLower) || baseAsset.includes(searchTermLower) || quoteAsset.includes(searchTermLower);
    }
    const searchString = `${symbol} ${baseAsset} ${quoteAsset} ${ticker.lastPrice.toLowerCase()} ${ticker.volume.toLowerCase()} ${this.formatVolume(ticker.volume).toLowerCase()} ${ticker.priceChangePercent.toLowerCase()} ${ticker.highPrice.toLowerCase()} ${ticker.lowPrice.toLowerCase()}`;
    return searchString.includes(searchTermLower);
  }

  // Сортировка инструментов по цене
  sortTools() {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.displayedTools.sort((a, b) => {
      const priceA = parseFloat(this.tickerData[a.symbol].lastPrice);
      const priceB = parseFloat(this.tickerData[b.symbol].lastPrice);
      return this.sortDirection === 'asc' ? priceA - priceB : priceB - priceA;
    });
  }

  private connectToWebsocket() {
    this.socket$ = webSocket('wss://stream.binance.com:9443/ws/!ticker@arr');

    this.websocketSubscription = this.socket$.subscribe(
      (data: any) => {
        data.forEach((item: any) => {
          this.tickerData[item.s] = {
            symbol: item.s,
            priceChangePercent: item.P,
            lastPrice: item.c,
            highPrice: item.h,
            lowPrice: item.l,
            volume: item.v
          };
        });
      },
      (err) => console.error('WebSocket error:', err),
      () => console.warn('WebSocket connection completed')
    );
  }

  private disconnectFromWebsocket() {
    if (this.websocketSubscription) {
      this.websocketSubscription.unsubscribe();
    }
    if (this.socket$) {
      this.socket$.complete();
    }
  }
}
