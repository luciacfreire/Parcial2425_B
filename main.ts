import {MongoClient, ObjectId} from "mongodb"
import { AuthorModel, BookModel } from "./types.ts";
import { fromBookModelToBook, verifyAuthors } from "./utils.ts";
import { fromAuthorModelToAuthor } from "./utils.ts";
import { json } from "node:stream/consumers";

const MONGO_URL = Deno.env.get("MONGO_URL");
if(!MONGO_URL){
  throw new Error("You need a mongo url");
}

const mongoClient = new MongoClient(MONGO_URL);
await mongoClient.connect();

const db = mongoClient.db("inventario");

const BooksCollection = db.collection<BookModel>("books");
const AuthorsCollection = db.collection<AuthorModel>("authors");

const handler = async (req:Request): Promise<Response> => {
  const method = req.method;
  const url = new URL(req.url);
  const path = url.pathname; 

  if(method === "GET"){
    if(path === "/libros"){
      const titulo = url.searchParams.get("titulo");
      if(titulo){
        const librosModels = await BooksCollection.find({
          title: {$regex: titulo, $options: "i"} 
        }).toArray();

        if(librosModels.length === 0){
          return new Response(
            JSON.stringify(
              {error:"No se han encontrado libros con este titulo."}),
              {status:404}
          );
        }

        const libros = await Promise.all(
          librosModels.map((bookModel) => fromBookModelToBook(bookModel,AuthorsCollection) )
        );

        return new Response(
          JSON.stringify(libros),
          {
            headers:{
              "content-type":"application/json"
            }
          }
        );

      } else{
        const librosModels = await BooksCollection.find({}).toArray();

        if(librosModels.length === 0){
          return new Response(
            JSON.stringify(
              {error:"No se han encontrado libros con este titulo."}),
              {status:404}
          );
        }

        const libros = await Promise.all(
          librosModels.map((bookModel)=> fromBookModelToBook(bookModel,AuthorsCollection))
        );

        return new Response(
          JSON.stringify(libros),
          {
            headers:{
              "content-type":"application/json"
            }
          }
        );
      }
    } else if(path === "/libro"){
      const id = url.searchParams.get("id");
      if(!id){
        return new Response(
          JSON.stringify(
            {error:"Proporciona un id"}
          ),
          {status:400}
        );
      }
      const bookModel = await BooksCollection.findOne({_id: new ObjectId(id)});

      if(!bookModel){
        return new Response(
          JSON.stringify({error:"No se ha encontrado el libro"}),
          {status:404}
        );
      }
      
      const book = await fromBookModelToBook(bookModel,AuthorsCollection);
      return new Response(JSON.stringify(book),{
          headers: {"content-type":"application/json"}
        }
      );
    }

  } else if(method === "POST"){
    if(path === "/libro"){
      const body = await req.json();
      const {title, authors,numsOfCopies} = body;

      if(!title || !authors){
        return new Response(
          JSON.stringify({error:"Los campos de libro y autores son campos necesarios."}),
          {status:400}
        );
      }

      //Comprobamos si alguno de los autores no existe
      if(!(await verifyAuthors(authors,AuthorsCollection))){
        return new Response(
          JSON.stringify({error:"Alguno de los autores no existe."}),
          {status:400}
        )
      }

      const {insertedId} = await BooksCollection.insertOne({
        title,
        authors: authors.map((id:string) => new ObjectId(id)),
        numsOfCopies: numsOfCopies || 0 
      });

      const book = await fromBookModelToBook(
        {
          _id: insertedId,
          title,
          authors : authors.map((id:string)=>new ObjectId(id)),
          numsOfCopies
        },
        AuthorsCollection
      );

      return new Response(
        JSON.stringify({
          message: "Libro creado exitosamente",
          libro: book,
        }), 
        {
          headers: {"content-type" : "application/json"}
        }
      );

    } else if(path === "/autor"){
      const body = await req.json();
      const {name,biography} = body;
      if(!name){
        return new Response(
          JSON.stringify({error:"El nombre es un campo necesario."}),
          {status:400}
        )
      };

      const {insertedId} = await AuthorsCollection.insertOne({
        name,
        biography: biography || "",
      });

      return new Response(
        JSON.stringify({
          message: "Autor creado exitosamente.",
          autor: 
            {
              id: insertedId,
              name,
              biography: biography || "",
            },
        }),
        {
          headers:
          {
          "content-type":"application/json"
          }
        }
      );

    }

  } else if(method == "PUT"){
    if(path === "/libro"){
      const body = await req.json();
      const {id,title,authors,numsOfCopies} = body;

      if(!id){
        return new Response(
          JSON.stringify({error:"Proporciona un id"}),
          {status:400}
        )
      }

      //Comprobamos si los autores existen
      if(authors && (!(await verifyAuthors(authors,AuthorsCollection)))){
        return new Response(
          JSON.stringify({error:"Alguno de los autores no existe"}),
          {status:400}
        )
      }

      const {modifiedCount} = await BooksCollection.updateOne(
        {_id : new ObjectId(id as string)},
        {
          $set: {
            title,
            authors: authors.map((id:string) => new ObjectId(id)),
            numsOfCopies: numsOfCopies || 0 
          }
        }
      );

      if(modifiedCount === 0){
        return new Response(
          JSON.stringify({error:"El libro no se ha encontrado"}),
          {status:404}
        );
      }

      const bookModel = await BooksCollection.findOne({
        _id : new ObjectId(id as string)
      });

      

      const book = await fromBookModelToBook(bookModel!, AuthorsCollection);

      return new Response(
        JSON.stringify({
          message: "Libro actualizado correctamente",
          libro: book
        }
        )
      );

    }

  } else if(method === "DELETE"){
    if(path === "/libro"){
      const id = url.searchParams.get("id");
      if(!id){
        return new Response(
          JSON.stringify({error:"Proporciona un id"}),
          {status:400}
        );
      }
      
      const {deletedCount} = await BooksCollection.deleteOne({
        _id : new ObjectId(id)
      });

      if(deletedCount === 0){
        return new Response(
          JSON.stringify({error:"Libro no encontrado"}),
          {
            status:404
          }
        );
      }

      return new Response(
        JSON.stringify("Libro eliminado exitosamente"),
        {
          headers:{
            "content-type":"application/json"
          }
        }
      );
      
    }
  }


  return new Response("endpoint not found");
};

Deno.serve({port:3000}, handler);