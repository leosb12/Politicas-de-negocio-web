import { Injectable } from '@angular/core';
import {
  Nodo,
  Conexion,
  TipoNodo,
  TipoCampo,
  CampoFormulario,
  CondicionDecision,
  OperadorCondicionDecision,
} from '../models/politica.model';
import {
  IaFlujoResponse,
  IaNodo,
  IaTransicion,
  IaTipoNodo,
  IaTipoCampo,
  IaRol,
  IaFormulario,
} from '../models/ia-flujo.model';

type MapperDepartment = {
  id: string;
  nombre: string;
};

export interface IaFlujoMapperContext {
  departamentos?: MapperDepartment[];
  defaultDepartamentoId?: string | null;
  responsableIniciadorId?: string;
}

/**
 * Servicio que convierte la respuesta del microservicio de IA
 * a los modelos internos de Nodo y Conexion del sistema
 */
@Injectable({ providedIn: 'root' })
export class IaFlujoMapperService {
  private readonly defaultIniciadorResponsableId =
    '__RESPONSABLE_INICIADOR_TRAMITE__';

  /**
   * Mapea la respuesta de IA a nodos y conexiones del sistema
   *
   * @param iaResponse Respuesta del microservicio de IA
   * @returns Objeto con arrays de Nodo y Conexion mapeados
   */
  mapIaResponseToFlujo(
    iaResponse: IaFlujoResponse,
    context?: IaFlujoMapperContext
  ): { nodos: Nodo[]; conexiones: Conexion[] } {
    const nodos = this.mapNodes(iaResponse, context);
    const conexiones = this.mapTransitions(iaResponse.transitions);

    return { nodos, conexiones };
  }

  /**
   * Mapea nodos de IA a nodos internos
   */
  private mapNodes(
    iaResponse: IaFlujoResponse,
    context?: IaFlujoMapperContext
  ): Nodo[] {
    const rolesById = new Map<string, IaRol>(
      (iaResponse.roles ?? []).map((role) => [role.id, role])
    );

    const formsByNodeId = this.buildFormsByNodeIdMap(iaResponse.forms ?? []);
    const outgoingByNodeId = this.buildOutgoingTransitionsMap(
      iaResponse.transitions ?? []
    );
    const incomingByNodeId = this.buildIncomingTransitionsMap(
      iaResponse.transitions ?? []
    );

    const departamentos = context?.departamentos ?? [];
    const defaultDepartamentoId =
      context?.defaultDepartamentoId ?? departamentos[0]?.id ?? null;
    const iniciadorResponsableId =
      context?.responsableIniciadorId ?? this.defaultIniciadorResponsableId;

    return iaResponse.nodes.map((iaNode) => {
      const tipo = this.mapNodeType(iaNode.type);
      const role = iaNode.responsibleRoleId
        ? rolesById.get(iaNode.responsibleRoleId) ?? null
        : null;

      const departamentoId =
        tipo === 'ACTIVIDAD'
          ? this.resolveDepartmentId(iaNode, role, departamentos, defaultDepartamentoId)
          : null;

      const isInitiator =
        tipo === 'ACTIVIDAD' && this.isInitiatorResponsibility(iaNode, role);

      const nodo: Nodo = {
        id: iaNode.id,
        tipo,
        nombre: iaNode.name,
        departamentoId,
        responsableTipo:
          tipo === 'ACTIVIDAD'
            ? isInitiator
              ? 'USUARIO'
              : 'DEPARTAMENTO'
            : null,
        responsableId:
          tipo === 'ACTIVIDAD'
            ? isInitiator
              ? iniciadorResponsableId
              : departamentoId
            : null,
        formulario:
          tipo === 'ACTIVIDAD'
            ? this.mapFormFields(formsByNodeId.get(iaNode.id) ?? null)
            : [],
        condiciones:
          tipo === 'DECISION'
            ? this.mapDecisionConditions(
                iaNode,
                outgoingByNodeId,
                incomingByNodeId,
                iaResponse.nodes,
                formsByNodeId
              )
            : [],
      };

      return nodo;
    });
  }

  private buildFormsByNodeIdMap(forms: IaFormulario[]): Map<string, IaFormulario> {
    const map = new Map<string, IaFormulario>();
    for (const form of forms) {
      if (!form.nodeId) {
        continue;
      }

      if (!map.has(form.nodeId)) {
        map.set(form.nodeId, form);
      }
    }

    return map;
  }

  private buildOutgoingTransitionsMap(
    transitions: IaTransicion[]
  ): Map<string, IaTransicion[]> {
    const map = new Map<string, IaTransicion[]>();

    for (const transition of transitions) {
      const bucket = map.get(transition.from) ?? [];
      bucket.push(transition);
      map.set(transition.from, bucket);
    }

    return map;
  }

  private buildIncomingTransitionsMap(
    transitions: IaTransicion[]
  ): Map<string, IaTransicion[]> {
    const map = new Map<string, IaTransicion[]>();

    for (const transition of transitions) {
      const bucket = map.get(transition.to) ?? [];
      bucket.push(transition);
      map.set(transition.to, bucket);
    }

    return map;
  }

  private resolveDepartmentId(
    iaNode: IaNodo,
    role: IaRol | null,
    departamentos: MapperDepartment[],
    defaultDepartamentoId: string | null
  ): string | null {
    if (!departamentos.length) {
      return defaultDepartamentoId;
    }

    const hintCandidates = [
      iaNode.departmentHint,
      role?.name,
      iaNode.name,
      iaNode.description,
    ];

    for (const hint of hintCandidates) {
      const matched = this.findDepartmentByHint(hint, departamentos);
      if (matched) {
        return matched.id;
      }
    }

    return defaultDepartamentoId;
  }

  private findDepartmentByHint(
    hint: string | null | undefined,
    departamentos: MapperDepartment[]
  ): MapperDepartment | null {
    const normalizedHint = this.normalizeText(hint);
    if (!normalizedHint) {
      return null;
    }

    const exact = departamentos.find(
      (departamento) => this.normalizeText(departamento.nombre) === normalizedHint
    );
    if (exact) {
      return exact;
    }

    const contains = departamentos.find((departamento) => {
      const normalizedDepartment = this.normalizeText(departamento.nombre);
      return (
        normalizedDepartment.includes(normalizedHint) ||
        normalizedHint.includes(normalizedDepartment)
      );
    });

    return contains ?? null;
  }

  private normalizeText(value: string | null | undefined): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private isInitiatorResponsibility(iaNode: IaNodo, role: IaRol | null): boolean {
    if (iaNode.responsibleType === 'initiator') {
      return true;
    }

    const text = this.normalizeText(
      `${role?.name ?? ''} ${iaNode.name ?? ''} ${iaNode.description ?? ''}`
    );

    return (
      text.includes('solicitante') ||
      text.includes('quien inicia') ||
      text.includes('iniciador') ||
      text.includes('ciudadano') ||
      text.includes('cliente')
    );
  }

  /**
   * Mapea transiciones de IA a conexiones internas
   */
  private mapTransitions(iaTransitions: IaTransicion[]): Conexion[] {
    return iaTransitions.map((transition) => ({
      origen: transition.from,
      destino: transition.to,
    }));
  }

  /**
   * Convierte tipos de nodo de IA a tipos internos
   */
  private mapNodeType(iaType: IaTipoNodo): TipoNodo {
    const typeMap: Record<IaTipoNodo, TipoNodo> = {
      start: 'INICIO',
      task: 'ACTIVIDAD',
      decision: 'DECISION',
      parallel_start: 'FORK',
      parallel_end: 'JOIN',
      end: 'FIN',
    };

    return typeMap[iaType];
  }

  /**
   * Convierte tipos de campo de IA a tipos internos
   */
  private mapFieldType(iaFieldType: IaTipoCampo): TipoCampo {
    const fieldMap: Partial<Record<IaTipoCampo, TipoCampo>> = {
      text: 'TEXTO',
      textarea: 'TEXTO',
      email: 'TEXTO',
      phone: 'TEXTO',
      number: 'NUMERO',
      currency: 'NUMERO',
      boolean: 'BOOLEANO',
      date: 'FECHA',
      file: 'ARCHIVO',
      select: 'TEXTO',
    };

    return fieldMap[iaFieldType] || 'TEXTO';
  }

  private mapFormFields(form: IaFormulario | null): CampoFormulario[] {
    if (!form?.fields?.length) {
      return [];
    }

    const uniqueNames = new Set<string>();

    return form.fields.map((field, index) => {
      const baseName = this.toCampoName(field.id || field.label || `campo_${index + 1}`);
      let nextName = baseName;
      let suffix = 2;

      while (uniqueNames.has(nextName)) {
        nextName = `${baseName}_${suffix}`;
        suffix += 1;
      }
      uniqueNames.add(nextName);

      return {
        campo: nextName,
        tipo: this.mapFieldType(field.type),
      };
    });
  }

  private toCampoName(source: string): string {
    const normalized = this.normalizeText(source)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return normalized || 'campo_generado_ia';
  }

  private mapDecisionConditions(
    iaNode: IaNodo,
    outgoingByNodeId: Map<string, IaTransicion[]>,
    incomingByNodeId: Map<string, IaTransicion[]>,
    iaNodes: IaNodo[],
    formsByNodeId: Map<string, IaFormulario>
  ): CondicionDecision[] {
    const outgoingTransitions = outgoingByNodeId.get(iaNode.id) ?? [];
    if (!outgoingTransitions.length) {
      return [];
    }

    const previousActivityId = this.findPreviousActivityId(
      iaNode.id,
      incomingByNodeId,
      iaNodes
    );
    const previousFormFields = previousActivityId
      ? this.mapFormFields(formsByNodeId.get(previousActivityId) ?? null)
      : [];

    return outgoingTransitions.map((transition, index) => {
      const result = this.resolveDecisionResult(transition, index, outgoingTransitions.length);
      const conditionText = this.normalizeConditionText(transition.condition, transition.label);

      return {
        resultado: result,
        siguiente: transition.to,
        origenActividadId: previousActivityId,
        grupo: this.buildDecisionGroup(conditionText, previousFormFields),
      };
    });
  }

  private findPreviousActivityId(
    decisionNodeId: string,
    incomingByNodeId: Map<string, IaTransicion[]>,
    iaNodes: IaNodo[]
  ): string | null {
    const incoming = incomingByNodeId.get(decisionNodeId) ?? [];
    const nodesById = new Map(iaNodes.map((node) => [node.id, node]));

    for (const transition of incoming) {
      const previous = nodesById.get(transition.from);
      if (previous?.type === 'task') {
        return previous.id;
      }
    }

    return null;
  }

  private resolveDecisionResult(
    transition: IaTransicion,
    index: number,
    total: number
  ): string {
    const text = this.normalizeText(`${transition.condition ?? ''} ${transition.label ?? ''}`);

    const yesKeywords = ['si', 'yes', 'true', 'aprueba', 'aprobado', 'cumple', 'valido'];
    const noKeywords = ['no', 'false', 'rechaza', 'rechazado', 'incumple', 'invalido'];

    if (yesKeywords.some((keyword) => text.includes(keyword))) {
      return 'SI';
    }

    if (noKeywords.some((keyword) => text.includes(keyword))) {
      return 'NO';
    }

    if (total === 2) {
      return index === 0 ? 'SI' : 'NO';
    }

    if (index === 0) {
      return 'SI';
    }

    if (index === total - 1) {
      return '*';
    }

    return `RUTA_${index + 1}`;
  }

  private normalizeConditionText(
    condition: string | null,
    label: string | null
  ): string {
    const conditionText = String(condition ?? '').trim();
    if (conditionText) {
      return conditionText;
    }

    return String(label ?? '').trim();
  }

  private buildDecisionGroup(
    conditionText: string,
    sourceFields: CampoFormulario[]
  ) {
    if (!conditionText || !sourceFields.length) {
      return null;
    }

    const firstField = sourceFields[0];
    const { operador, valor } = this.resolveDecisionOperatorAndValue(
      conditionText,
      firstField.tipo
    );

    return {
      operadorLogico: 'AND' as const,
      reglas: [
        {
          campo: firstField.campo,
          tipo: firstField.tipo,
          operador,
          valor,
        },
      ],
      grupos: [],
    };
  }

  private resolveDecisionOperatorAndValue(
    conditionText: string,
    tipo: TipoCampo
  ): { operador: OperadorCondicionDecision; valor?: string | number | boolean | null } {
    const text = this.normalizeText(conditionText);

    if (tipo === 'BOOLEANO') {
      if (text.includes('no') || text.includes('false')) {
        return { operador: 'ES_FALSO' };
      }
      return { operador: 'ES_VERDADERO' };
    }

    if (text.includes('>=') || text.includes('mayor o igual')) {
      return { operador: 'MAYOR_O_IGUAL', valor: this.extractNumericValue(conditionText) };
    }
    if (text.includes('<=') || text.includes('menor o igual')) {
      return { operador: 'MENOR_O_IGUAL', valor: this.extractNumericValue(conditionText) };
    }
    if (text.includes('>') || text.includes('mayor que')) {
      return { operador: 'MAYOR_QUE', valor: this.extractNumericValue(conditionText) };
    }
    if (text.includes('<') || text.includes('menor que')) {
      return { operador: 'MENOR_QUE', valor: this.extractNumericValue(conditionText) };
    }
    if (text.includes('!=') || text.includes('distinto')) {
      return { operador: 'DISTINTO', valor: this.extractTextValue(conditionText) };
    }
    if (text.includes('contiene')) {
      return { operador: 'CONTIENE', valor: this.extractTextValue(conditionText) };
    }
    if (text.includes('vacio') || text.includes('vacío')) {
      return text.includes('no ')
        ? { operador: 'NO_ESTA_VACIO' }
        : { operador: 'ESTA_VACIO' };
    }

    if (tipo === 'NUMERO') {
      return { operador: 'IGUAL', valor: this.extractNumericValue(conditionText) };
    }

    return { operador: 'IGUAL', valor: this.extractTextValue(conditionText) };
  }

  private extractNumericValue(text: string): number {
    const matched = text.match(/-?\d+(?:[\.,]\d+)?/);
    if (!matched) {
      return 0;
    }

    return Number(matched[0].replace(',', '.'));
  }

  private extractTextValue(text: string): string {
    return text.trim().slice(0, 120) || 'valor';
  }
}
