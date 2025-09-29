import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { QuestionService } from './question.service';
import { ScoreService } from './score.service';

@NgModule({
  imports: [
    CommonModule,
    HttpClientModule
  ],
  providers: [
    QuestionService,
   
    ScoreService
  ]
})
export class ApiModule { }
