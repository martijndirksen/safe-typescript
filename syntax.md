# Syntax

```ts
[] is not allowed
[t_0, t_1, ..., t_n]
```

# Subtyping 

`<` is subtype, `!<` not a subtype

## Identity

Same type

```ts
[boolean] < [boolean]
```

## Width subtyping not allowed

The number of elements must match

```ts
[boolean] !< [boolean, string]
[boolean, string] !< [boolean]
```

## Order is significant

A tuple is an ordered pair of types, hence another ordering affects the type.

```ts
[string, boolean] !< [boolean, string]
```

## Depth subtyping

A tuple can be a depth subtype of another tuple if the constituent tuple elements are subtypes
of their respective source tuple element type.

```ts
A < B
[A] < [B]
```

## Rest elements

A tuple type can optionally have a rest element type. A rest element type can appear once. A rest element indicates that a tuple can contain 0 or more of such elements at that position.

A rest element type can only be used if there are two elements in the tuple type.

```ts
...T[]
[...T[]] is not allowed, as it is the same as T[]
[...T[], ...T[]] is not allowed, multiple rest elements are not allowed
[...T[], T]
[T, ...T[]]
[T, ...T[], T]
```

Subtyping rules are more complex. Non-rest elements retain normal subtyping rules. Also note that width subtyping is allowed when a rest element is used.

```ts
[...X[], Y] < [Y]
[...X[], Y] < [X, Y]
[...X[], Y] < [X_1, ..., X_N, Y]
[X, ...Y[]] < [X]
[X, ...Y[]] < [X, Y]
[X, ...Y[]] < [X, Y_1, ..., Y_N]
[X, ...Y[], Z] < [X, Z]
[X, ...Y[], Z] < [X, Y, Z]
[X, ...Y[], Z] < [X, Y_1, ..., Y_N, Z]
```

