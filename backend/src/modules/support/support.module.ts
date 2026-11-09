import { SupportOperations } from './support-operations.service';
import { Module } from '@nestjs/common';
import { SupportPresenter } from './support-presenter.service';

@Module({ providers: [SupportPresenter, SupportOperations], exports: [SupportPresenter, SupportOperations] })
export class SupportModule {}
