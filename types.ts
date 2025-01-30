import { ObjectId, OptionalId } from "mongodb";

export type BookModel = OptionalId <{
    title: string,
    authors: ObjectId[],
    numsOfCopies: number
}>;

export type AuthorModel = OptionalId <{
    name: string,
    biography: string
}>;

export type Book = {
    id: string,
    title: string,
    authors: Partial<Author>[],
    numsOfCopies: number
};

export type Author = {
    id: string,
    name: string,
    biography: string
}