import PropTypes from 'prop-types';
import React from 'react';
import cn from 'classnames';
import styled from 'styled-components';
import prop from 'ramda/src/prop';
import { ContextMenuTrigger } from 'react-contextmenu';

import dates from './utils/dates';
import { accessor, elementType } from './utils/propTypes';
import { accessor as get } from './utils/accessors';
import { RIGHT_CLICK_EVENT } from './ContextMenuTypes';

let propTypes = {
  allDayAccessor: accessor,
  endAccessor: accessor,
  event: PropTypes.object.isRequired,
  eventComponent: elementType,
  eventPropGetter: PropTypes.func,
  eventWrapperComponent: elementType.isRequired,
  onDoubleClick: PropTypes.func,
  onInlineEditEventTitle: PropTypes.func.isRequired,
  onSelect: PropTypes.func,
  selected: PropTypes.bool,
  selectedList: PropTypes.array,
  slotEnd: PropTypes.instanceOf(Date),
  slotStart: PropTypes.instanceOf(Date),
  startAccessor: accessor,
  titleAccessor: accessor,
};

const StyledEvent = styled.div`
  background-color: ${({ backgroundColor: v }) => v || 'transparent'};
  border-color: ${({ borderColor: v }) => v || 'currentColor'};
  border-style: ${({ borderStyle: v }) => v || 'none'};
  border-width: ${({ borderWidth: v }) => v || 'medium'};
  color: ${({ color: v }) => v || 'currentColor'};
  font-family: ${({ fontFamily: v }) => v || 'inherit'};
  font-size: ${({ fontSize: v }) => v || 'medium'};
  font-style: ${({ fontStyle: v }) => v || 'normal'};
  font-weight: ${({ fontWeight: v }) => v || 'normal'};
  text-align: ${({ textAlign: v }) => v || 'center'};
`;

const StyledInput = styled.input`
  width: 100%;
  padding: 2px 5px;
  border: 0;
  background-color: ${({ backgroundColor: v }) => v || 'transparent'};
  color: ${({ color: v }) => v || 'currentColor'};
  font-family: ${({ fontFamily: v }) => v || 'inherit'};
  font-size: ${({ fontSize: v }) => v || 'medium'};
  font-style: ${({ fontStyle: v }) => v || 'normal'};
  font-weight: ${({ fontWeight: v }) => v || 'normal'};
  text-align: ${({ textAlign: v }) => v || 'center'};

  &:focus {
    outline: none;
  }
`;

class EventCell extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isEditingEventTitle: false,
      title: get(props.event.data, props.titleAccessor),
    };
  }

  componentWillReceiveProps(nextProps) {
    const { event: { data: currentEvent }, titleAccessor } = this.props;
    const { event: { data: nextEvent } } = nextProps;
    const [eventTitle, nextEventTitle] = [
      get(currentEvent, titleAccessor),
      get(nextEvent, titleAccessor),
    ];
    if (eventTitle !== nextEventTitle) {
      this.setState({ title: nextEventTitle });
    }
  }

  handleEditing = () => {
    this.setState({ isEditingEventTitle: true });
  };

  handleChange = ({ target: { value } }) => {
    this.setState({ title: value });
  };

  handleKeyPress = e => {
    const { onInlineEditEventTitle, event: { data: event } } = this.props;
    if (e.key == 'Enter') {
      onInlineEditEventTitle({ event, title: this.state.title });
      this.setState({ isEditingEventTitle: false });
    }
  };

  handleMoveCaretToEnd = ({ target }) => {
    const { title } = this.state;
    if (title && target.setSelectionRange) {
      target.setSelectionRange(title.length, title.length);
    }
  };

  handleBlur = () => {
    const { onInlineEditEventTitle, event: { data: event } } = this.props;
    onInlineEditEventTitle({ event, title: this.state.title });
    this.setState({ isEditingEventTitle: false });
  };

  render() {
    let {
      className,
      endAccessor,
      event,
      eventComponent: Event,
      eventPropGetter,
      eventWrapperComponent: EventWrapper,
      onDoubleClick,
      onInlineEditEventTitle,
      onSelect,
      selected,
      slotEnd,
      slotStart,
      startAccessor,
      titleAccessor,
      ...props
    } = this.props;

    let data = event.data,
      title = get(data, titleAccessor),
      end = get(data, endAccessor),
      start = get(data, startAccessor),
      isAllDay = get(data, props.allDayAccessor),
      continuesPrior = dates.lt(start, slotStart, 'day'),
      continuesAfter = dates.gte(end, slotEnd, 'day');

    if (eventPropGetter)
      var { style, className: xClassName } = eventPropGetter(data, start, end, selected);

    return (
      <EventWrapper event={event}>
        {/* ContextMenuTrigger needs to be wrapped in a div for dnd purposes - AR Wed Oct 18 09:43:40 EDT 2017 */}
        <div>
          <ContextMenuTrigger
            collect={props => ({ ...props, event: data })}
            holdToDisplay={-1}
            id={RIGHT_CLICK_EVENT}
          >
            <div
              tabIndex="-1"
              style={{ ...props.style, ...style }}
              className={cn('rbc-event', className, xClassName, {
                'rbc-selected': selected,
                'rbc-event-allday':
                  isAllDay || dates.diff(start, dates.ceil(end, 'day'), 'day') > 1,
                'rbc-event-continues-prior': continuesPrior,
                'rbc-event-continues-after': continuesAfter,
              })}
              onClick={e => onSelect(data, e)}
              /*onDoubleClick={e => onDoubleClick(event, e)}*/
              onDoubleClick={this.handleEditing}
            >
              <StyledEvent {...data.styles}>
                <div className="rbc-event-content" title={title}>
                  {Event && !this.state.isEditingEventTitle ? (
                    <Event event={data} title={title} />
                  ) : this.state.isEditingEventTitle ? (
                    <StyledInput
                      {...data.styles}
                      spellCheck={true}
                      autoFocus={this.state.isEditingEventTitle}
                      onBlur={this.handleBlur}
                      onChange={this.handleChange}
                      onFocus={this.handleMoveCaretToEnd}
                      onKeyPress={this.handleKeyPress}
                      type="text"
                      value={this.state.title}
                    />
                  ) : (
                    title
                  )}
                </div>
              </StyledEvent>
            </div>
          </ContextMenuTrigger>
        </div>
      </EventWrapper>
    );
  }
}

EventCell.propTypes = propTypes;

EventCell.defaultProps = {
  onInlineEditEventTitle: () => {},
};

export default EventCell;
