extends Control
var player: CharacterBody2D

# Очередь сообщений для вывода
var message_queue: Array[String] = []

# Идёт ли сейчас печать текста
var is_typing: bool = false

# Скорость печати одного символа
@export var char_delay: float = 0.08

# Текущая анимация
var typing_tween: Tween


@onready var console: RichTextLabel = \
	$VSplitContainer/Panel_Bottom/VSplitContainer/MarginContainer/RichTextLabel

@onready var input: LineEdit = \
	$VSplitContainer/Panel_Bottom/VSplitContainer/LineEdit


func _ready() -> void:
	# Ищем персонажа по группе player
	player = get_tree().get_first_node_in_group("player") as CharacterBody2D

	if player == null:
		push_error("Персонаж с группой 'player' не найден")

	# Подключаем обработчик отправки текста по клавише Enter
	input.text_submitted.connect(_on_text_submitted)

	# Разрешаем LineEdit получать фокус
	input.focus_mode = Control.FOCUS_ALL

	# Устанавливаем фокус после загрузки сцены
	input.call_deferred("grab_focus")

	# В начале показываем весь уже существующий текст
	console.visible_characters = -1


func _on_text_submitted(command: String) -> void:
	# Убираем пробелы по краям строки
	command = command.strip_edges()

	# Если команда не пустая — выводим и обрабатываем её
	if not command.is_empty():
		print_console("> " + command)
		handle_command(command)

	# Очищаем поле ввода
	input.clear()

	# Ждём завершения текущего кадра,
	# затем снова возвращаем фокус в LineEdit
	await get_tree().process_frame
	input.grab_focus()


func handle_command(command: String) -> void:
	match command.to_lower():

		"помоги":
			print_console(
				"Доступные команды: помоги, привет, подойди, вверх, вниз, влево, вправо, стоп, очисти"
			)

		"привет":
			print_console("Привет!")

		"ты куда пропал":
			print_console("Теперь я тут... Да уж. Местечко сомнительное. ")

		"подойди":
			if player != null:
				player.move_by_command(Vector2.RIGHT * 100.0)
				print_console("Я иду вправо")
			else:
				print_console("Персонаж не найден")

		"вверх":
			if player != null:
				player.move_by_command(Vector2.UP * 100.0)
				print_console("Я иду вверх")
			else:
				print_console("Персонаж не найден")

		"вниз":
			if player != null:
				player.move_by_command(Vector2.DOWN * 100.0)
				print_console("Я иду вниз")
			else:
				print_console("Персонаж не найден")

		"влево":
			if player != null:
				player.move_by_command(Vector2.LEFT * 100.0)
				print_console("Я иду влево")
			else:
				print_console("Персонаж не найден")

		"вправо":
			if player != null:
				player.move_by_command(Vector2.RIGHT * 100.0)
				print_console("Я иду вправо")
			else:
				print_console("Персонаж не найден")

		"стоп":
			if player != null:
				player.stop_command_movement()
				print_console("Я остановился")
			else:
				print_console("Персонаж не найден")

		"очисти":
			clear_console()

		_:
			print_console("Неизвестная команда: " + command)


func print_console(message: String) -> void:
	# Добавляем сообщение в очередь
	message_queue.append(message)

	# Если сейчас ничего не печатается — запускаем печать
	if not is_typing:
		show_next_message()


func show_next_message() -> void:
	# Если очередь пуста — заканчиваем печать
	if message_queue.is_empty():
		is_typing = false
		console.visible_characters = -1
		return

	is_typing = true

	# Берём первое сообщение из очереди
	var message: String = message_queue.pop_front()

	# Количество символов до добавления нового сообщения
	var old_character_count: int = console.get_total_character_count()

	# Добавляем сообщение в RichTextLabel
	console.append_text(message)
	console.newline()

	# Количество символов после добавления сообщения
	var new_character_count: int = console.get_total_character_count()

	# Скрываем только новые символы
	console.visible_characters = old_character_count

	# Количество добавленных символов
	var added_characters: int = new_character_count - old_character_count

	# Продолжительность анимации
	var animation_time: float = added_characters * char_delay

	# Создаём анимацию
	typing_tween = create_tween()

	typing_tween.tween_property(
		console,
		"visible_characters",
		new_character_count,
		animation_time
	)

	# После окончания печати запускаем следующее сообщение
	await typing_tween.finished

	show_next_message()


func clear_console() -> void:
	# Очищаем очередь сообщений
	message_queue.clear()

	# Останавливаем текущую анимацию
	if typing_tween and typing_tween.is_valid():
		typing_tween.kill()

	# Очищаем консоль
	console.clear()

	# Снова показываем весь текст, если он появится
	console.visible_characters = -1

	is_typing = false
