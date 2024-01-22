import { Migration } from '@mikro-orm/migrations';

export class Migration20240119164121 extends Migration {

  async up(): Promise<void> {
    this.addSql('drop index `custom_show_content_program_uuid_index`;');

    this.addSql('alter table `custom_show_content` add column `index` integer not null constraint `custom_show_content_content_uuid_foreign` references `program` (`uuid`) on update cascade constraint `custom_show_content_custom_show_uuid_foreign` references `custom_show` (`uuid`) on update cascade;');
    this.addSql('alter table `custom_show_content` rename column `program_uuid` to `content_uuid`;');
    this.addSql('create index `custom_show_content_content_uuid_index` on `custom_show_content` (`content_uuid`);');
    this.addSql('create unique index `custom_show_content_custom_show_uuid_content_uuid_index_unique` on `custom_show_content` (`custom_show_uuid`, `content_uuid`, `index`);');
  }

}