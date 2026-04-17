import { Pipe, PipeTransform } from '@angular/core';
import { NodoCanvas } from '../models/politica.model';

@Pipe({ name: 'findNode', standalone: true, pure: false })
export class FindNodePipe implements PipeTransform {
  transform(nodes: NodoCanvas[], id: string): NodoCanvas | undefined {
    return nodes.find((n) => n.id === id);
  }
}
