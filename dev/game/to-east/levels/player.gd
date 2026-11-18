extends CharacterBody2D

@export var speed: float = 1.0

@onready var at: AnimationTree = $AnimationTree

var direction: Vector2 = Vector2.ZERO

# Данные для движения по команде терминала
var command_target: Vector2 = Vector2.ZERO
var command_active: bool = false


func _ready():
	at.active = true


func _physics_process(_delta: float) -> void:
	var keyboard_direction := Input.get_vector(
		"left",
		"right",
		"up",
		"down"
	).normalized()

	# Движение с клавиатуры
	if keyboard_direction != Vector2.ZERO:
		command_active = false
		direction = keyboard_direction

	# Движение по команде терминала
	elif command_active:
		direction = global_position.direction_to(command_target)

		# Остановка около цели
		if global_position.distance_to(command_target) <= 3.0:
			command_active = false
			direction = Vector2.ZERO

	# Персонаж не двигается
	else:
		direction = Vector2.ZERO

	velocity = direction * speed
	move_and_slide()

	uap()


# Движение персонажа на указанное расстояние
func move_by_command(offset: Vector2) -> void:
	command_target = global_position + offset
	command_active = true


# Остановка движения по команде
func stop_command_movement() -> void:
	command_active = false
	direction = Vector2.ZERO
	velocity = Vector2.ZERO


# Ваша функция оставлена без изменений
func uap():
	if (velocity == Vector2.ZERO):
		#print('Player - not Walking, Velocity - zero')
		at["parameters/conditions/idled"] = false
		at["parameters/conditions/walking"] = true
	else:
		#print('Player - Walking, Velocity - not zero')
		at["parameters/conditions/idled"] = true
		at["parameters/conditions/walking"] = false
	
	if(direction != Vector2.ZERO):
		at["parameters/idle/blend_position"] = direction
		at["parameters/walk/BlendSpace2D/blend_position"] = direction
