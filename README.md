# voodoo-ts

voodoo-ts aims to be a validation library with short syntax and a nice developer experience. This library is inspired by the [class-validator](https://github.com/typestack/class-validator) package.

## Example

```typescript
@Validator()
class UserDto {
  username!: string;
  email!: string;

  description?: string;

  itemsCollected: string[];
}

const result = validate(UserDto, {
  username: 'Thanos',
  email: 'thanos@example.com',

  description: 'Purple dude',

  itemCollected: ['Soul Stone'],
});
```

Validators use the type hints to verify your input data.

## How it works

Under the hood [ts-morph](https://ts-morph.com) is used to analyze the class definitions. When the `@Valdidator()` decorator is used, the call site's line number will be extracted from the call stack.
This information is used to locate the class definition in the source code. As far as I know this is the only way to make the link from runtime to compiletime. This approach is rather hacky and leads to a number of caveats (see "Caveats" section).

## Supported syntax

### Basic types

```typescript
@Validator()
class UserDto {
  username!: string;
  alias?: string; // optional

  level!: number;
  isAdmin!: boolean;
}
```

### Inheritance

```typescript
@Validator()
class UserDto {
  username!: string;
  email!: string;
}

@Validator()
class AdminUserDto extends UserDto {
  permissions!: string[];
}
```

### Enums

```typescript
enum TestEnum {
  YES = 'yes',
  NO = 'no',
}

@Validator()
class Test {
  enumProperty!: TestEnum;
}
```

### Arrays

```typescript
@Validator()
class Gauntlet {
  infinityStones: string[];
  powerupForEachInfinityStone: number[];
}
```

Arrays support basic types, nested validators & enums.

### Unions

```typescript
@Validator()
class Test {
  basicProperty!: number | string | boolean;
  nullable!: number | null;
}
```

### Nested

```typescript
interface IAnimal {
  animalName: string;
  rating: number;
}

@Validator()
class Food {
  name!: string;
  rating!: number;
}

@Validator()
class User {
  favoriteFood!: Food;
  favoriteFoods!: Food[]; // Arrays are supported
  favoriteFoodWithoutRating!: Omit<Food, 'rating'>; // Omit<T, U> is supported
  favoriteFoodName!: Pick<Food, 'name'>; // Pick<T, U> is also supported

  favoriteAnimal!: IFavoriteAnimal; // Interfaces
  favoriteDrink!: {
    // Object literals
    drinkName: string;
    rating: number;
  };
}
```

Self-referential structures are also possible

```typescript
@Validator()
class TreeNode {
  name!: string;
  children!: TreeNode[];
}
```

### Tuples

```typescript
@Validator()
class Test {
  tuple!: [number, string];
}
```

### Records

```typescript
@Validator()
class Test {
  record!: Record<string, number>;
}
```

## Decorators

voodoo-ts ships with some decorators to define constraints that can't be provided by type hints.

If you need something that can't be covered by these decorators, you can create your own using `createValidationDecorator`. You can use the existing decorators as reference.

### @Validate((node: DecoratorNode, value: any) => INodeValidationResult)

Generic decorator which takes a function as validation callback. API is work in progress.

### @IsNumber()

Validates if a string can be parsed as number (including floats)

### @IsInteger(radix?)

Validates if a string can be parsed as an integer.

### @Length(min, max?)

Validates string or array length. If you have an array of strings you can use `@ArrayLength(min, max?)` and `StringLength(min, max?)`

### @Range(min, max?)

Validates if a number is between min and max.

### @IsNumberList(separator?, radix?)

Checks if a string consists of a list of numbers separated by `separator`.

### @ValidateIf((value: any, values: Record<string, any>) => boolean)

Validate a field only if the callback returned `true`.

## Caveats

Since voodoo-ts uses static code analysis to enable much of it's goodies, it is necessary to ship your source code with your deployment (for now).

Because of this, it will not be usable in a browser environment. However, there might be solutions for this, but they will require some extra build steps.

You'll also need sourcemaps and sourcemap support. Tested ways to run applications using voodoo-ts are `ts-node` and running `tsc` and executing the compiled .js files. This _might_ work with babel or other bundlers, but you need to make sure that sourcemaps are present and useable.

There are also minor restricitons. For example you can't put the decorator and the `class` keyword in the same line. For most formatted code (especially with prettier), this shouldn't cause too much trouble.

Related to this, you **must** use the decorator syntax to annotate the class, so this

```typescript
class Test {
  foo!: number;
}

Validator(Test); // <- will probably crash and burn
```

won't work.

## Todo

Error formatting is still work in progress. It's better than the raw error structure coming from the "AST", but there will be probably some improvements.
