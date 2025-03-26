import { Component, effect, inject, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { MessageService } from './message.service';
import { FormsModule, NgForm } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgClass, FormsModule],
  template: `
    <h1>🤖 Angular Generative AI Demo</h1>

    @for (message of messages(); track message.id) {
      <pre
        [innerHTML]="message.safeHtml"
        id="message_{{message.id}}"
        class="chat-message"
        [ngClass]="{
          'from-user': message.fromUser,
          generating: message.generating
        }"
        ></pre
      >
    }

    <form #form="ngForm" (ngSubmit)="sendMessage(form, form.value.message)">
      <input
        name="message"
        placeholder="Type a message"
        ngModel
        required
        autofocus
        [disabled]="generatingInProgress()"
      />
      <button type="submit" [disabled]="generatingInProgress() || form.invalid">
        Send
      </button>
    </form>
  `,
})
export class AppComponent implements OnInit {
  private readonly messageService = inject(MessageService);

  readonly messages = this.messageService.messages;
  readonly generatingInProgress = this.messageService.generatingInProgress;

  constructor(private domSanitizer: DomSanitizer) {}

  ngOnInit(): void {
    setInterval(() => {

      // Extrair e executar o script
      const messages = document.getElementsByClassName(`chat-message`);
      let scripts: NodeListOf<HTMLScriptElement> | undefined;

      if (messages && messages.length) {
        scripts = messages[messages.length-1].querySelectorAll('script');
      }

      if (scripts && scripts.length) {
        scripts.forEach(s => {
          console.log("executando script");
          eval(s.innerHTML); // Cuidado: eval pode ser perigoso com código não confiável
        });
      } else {
        console.log("não tem script");
      }

    }, 3000)
  }

  bypassSecurity(value: string, messageId: string): SafeHtml {
    console.log(value);
    try {
      let safe: SafeHtml = this.domSanitizer.bypassSecurityTrustHtml(value);
      return safe;
    } catch(e) {
      console.error(e);
      throw e;
    }
  }

  private readonly scrollOnMessageChanges = effect(() => {
    // run this effect on every messages change
    this.messages();

    // scroll after the messages render
    setTimeout(() =>
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth',
      }),
    );
  });

  sendMessage(form: NgForm, messageText: string): void {
    this.messageService.sendMessage(messageText);
    form.resetForm();
  }
}
