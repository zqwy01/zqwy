extends RichTextLabel

@export var text_speed: float = 0.04 # задержка между буквами

func _ready() -> void:
	show_text("Версии: {Ядро: 1} {Шрифт: 1} \n")

func show_text(new_text: String) -> void:
	text = new_text
	visible_characters = 0

	for i in range(new_text.length()):
		visible_characters = i + 1
		await get_tree().create_timer(text_speed).timeout
