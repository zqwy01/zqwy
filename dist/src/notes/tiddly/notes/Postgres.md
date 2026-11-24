Существует не малое число баз данных, а точнее это множество постоянно - увеличивается, так как напрямую связано с хранением данных в масштабе.
Но сейчас необходимо провести экскурс по реаляционной субд - postgres.

TRUNCATE TABLE - полная очистка таблицы;

например очистка попыток входа: TRUNCATE TABLE oc_bruteforce_attempts;

Изучить лимитные характеристики postgres, возможно с помощью следующих команд:
```
 - SHOW shared_buffers; 
 - SHOW work_mem; 
 - SHOW maintenance_work_mem;
 - SHOW autovacuum_work_mem;
 - SHOW effective_cache_size;
 - SHOW max_connections;
 - SHOW temp_file_limit; – если задан; 
 - SHOW log_temp_files; – полезно для понимания spill-to-temp
```

# Что эти характеристики означают?

    shared_buffers = 128MB
    Это фиксированная разделяемая память под буферы Postgres на весь кластер.

    work_mem = 4MB
    Это лимит для каждой операции сортировки/хэш-таблицы. Важно: для сложного запроса может быть несколько сортировок/хэшей и/или параллельные воркеры — тогда суммарно может получиться “во много раз больше”, чем 4MB. Когда лимит операции превышается — она начинает писать во временные файлы (spill на диск), вместо “бесконечного роста”. postgresql.org

    maintenance_work_mem = 64MB
    Это лимит для maintenance-операций (VACUUM/CREATE INDEX/…): в рамках одной maintenance-сессии.

    autovacuum_work_mem = -1
    -1 означает: использовать maintenance_work_mem для каждого autovacuum worker’а. То есть автоваакум по памяти ограничен примерно тем же 64MB на воркер. postgresql.org

    max_connections = 100
    Это не “память”, а верхняя грань числа бэкендов. Реальный расход work_mem зависит от того, сколько запросов реально делают sort/hash одновременно и есть ли parallel query.